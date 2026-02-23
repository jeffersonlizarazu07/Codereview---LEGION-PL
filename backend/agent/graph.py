import os
from typing import Annotated, Literal, TypedDict

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages

from agent.github_tools import get_branch_diff, get_file_content, get_repo_tree

# ── Configuración del LLM ──────────────────────────────────────────
# ChatOpenAI funciona con OpenRouter porque son compatibles con la misma API
llm = ChatOpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.getenv("OPENROUTER_API_KEY"),
    model="google/gemini-2.0-flash-001",
    temperature=0.2,  # 0 = más determinista, 1 = más creativo
)

# ── Estado del agente ──────────────────────────────────────────────
# TypedDict es como una interface de TypeScript:
#
# TS:  interface AgentState { messages: Message[], branch: string, ... }
# Py:  class AgentState(TypedDict): messages: list, branch: str, ...

class AgentState(TypedDict):
    messages: Annotated[list, add_messages]  # add_messages = acumula en vez de reemplazar
    branch: str
    mode: Literal["qa", "review", "unknown"]
    diff_data: dict
    file_contents: dict
    final_output: str

# ── Nodo 1: Router ────────────────────────────────────────────────
async def router_node(state: AgentState) -> AgentState:
    """
    Decide si el usuario quiere Q&A o un code review completo.
    """
    last_message = state["messages"][-1].content  # último mensaje del usuario

    system = SystemMessage(content="""Eres un router para un agente de code review.
Clasifica la intención del usuario en exactamente una de:
- "review": El usuario quiere un code review completo de la rama
- "qa": El usuario quiere hacer una pregunta específica sobre el código

Responde ÚNICAMENTE con la palabra "review" o "qa". Nada más.""")

    response = await llm.ainvoke([system, HumanMessage(content=last_message)])
    mode = response.content.strip().lower()

    if mode not in ["review", "qa"]:
        mode = "qa"

    return {**state, "mode": mode}  # {**state} = {...state} en JS (spread operator)

# ── Nodo 2: Fetch Diff ────────────────────────────────────────────
async def fetch_diff_node(state: AgentState) -> AgentState:
    """
    Obtiene el diff entre la rama objetivo y main.
    También descarga el contenido completo de los archivos cambiados.
    """
    branch = state["branch"]
    diff_data = await get_branch_diff(branch)

    if "error" in diff_data:
        error_msg = AIMessage(content=f"❌ Error: {diff_data['error']}")
        return {**state, "messages": [error_msg], "diff_data": diff_data}

    # Descargar contenido completo de cada archivo cambiado
    file_contents = {}
    for f in diff_data.get("files", []):
        filepath = f["filename"]
        content = await get_file_content(filepath, branch)
        file_contents[filepath] = content

    return {**state, "diff_data": diff_data, "file_contents": file_contents}

# ── Nodo 3: Q&A ───────────────────────────────────────────────────
async def qa_node(state: AgentState) -> AgentState:
    """
    Responde preguntas sobre el código usando el diff y los archivos como contexto.
    """
    question = state["messages"][-1].content
    branch = state["branch"]
    diff_data = state.get("diff_data", {})
    file_contents = state.get("file_contents", {})

    # Construimos el contexto con el contenido de los archivos
    context_parts = []
    for filename, content in file_contents.items():
        # Truncamos archivos muy grandes para no explotar el contexto del LLM
        truncated = content[:3000] + "\n[... truncado ...]" if len(content) > 3000 else content
        context_parts.append(f"### Archivo: {filename}\n```\n{truncated}\n```")

    # Contexto del diff
    diff_parts = []
    for f in diff_data.get("files", []):
        patch = f.get("patch", "")
        if patch and patch != "[archivo binario o vacío]":
            diff_parts.append(f"### Diff: {f['filename']}\n```diff\n{patch[:2000]}\n```")

    context = "\n\n".join(context_parts[:5])
    diff_context = "\n\n".join(diff_parts[:5])

    system = SystemMessage(content=f"""Eres un experto en code review analizando una rama de GitHub.

Rama: {branch} (comparada contra main)
Archivos cambiados: {[f['filename'] for f in diff_data.get('files', [])]}

## Contenido de archivos:
{context}

## Diffs:
{diff_context}

INSTRUCCIONES IMPORTANTES:
- Analiza el código que tienes disponible aunque sea parcial
- Para complejidad ciclomática: cuenta los if, for, switch, case, &&, || de cada función
- Nunca digas que no puedes analizar — siempre da una respuesta basada en el código visible
- Incluye rutas de archivos y nombres de funciones específicos
- Sé técnico y directo, tu audiencia son ingenieros senior
- SIEMPRE responde en español, sin excepciones""")

    # Pasamos todo el historial de mensajes para mantener contexto conversacional
    response = await llm.ainvoke([system, HumanMessage(content=question)])

    return {**state, "messages": [response]}

# ── Nodo 4: Code Review ───────────────────────────────────────────
async def review_node(state: AgentState) -> AgentState:
    """
    Genera un code review estructurado con hallazgos, severidad y sugerencias.
    """
    diff_data = state.get("diff_data", {})
    file_contents = state.get("file_contents", {})
    branch = state["branch"]

    if "error" in diff_data:
        msg = AIMessage(content=f"❌ No se puede hacer el review: {diff_data['error']}")
        return {**state, "messages": [msg]}

    if not diff_data.get("files"):
        msg = AIMessage(content="⚠️ No hay archivos cambiados entre esta rama y main.")
        return {**state, "messages": [msg]}

    # Construimos el contexto completo para el review
    review_context = []
    for f in diff_data.get("files", []):
        filename = f["filename"]
        patch = f.get("patch", "")
        full_content = file_contents.get(filename, "")
        truncated = full_content[:4000] + "\n[truncado]" if len(full_content) > 4000 else full_content

        review_context.append(f"""
### {filename} ({f['status']}, +{f['additions']} -{f['deletions']})
**Diff:**
````diff
{patch[:2000]}
````
**Archivo completo:**
````go
{truncated}
```""")

    context_str = "\n---\n".join(review_context)
    files_list = [f["filename"] for f in diff_data.get("files", [])]

    system = SystemMessage(content=f"""Eres un senior software engineer haciendo un code review exhaustivo.

Rama: {branch} vs main
Archivos cambiados: {files_list}

{context_str}

Para cada problema encontrado, usa EXACTAMENTE este formato:

---FINDING---
SEVERITY: [CRITICAL|HIGH|MEDIUM|LOW|INFO]
CATEGORY: [Security|Performance|Bug|Style|Architecture|Testing|Documentation]
FILE: [ruta del archivo]
LINES: [ej: 45-67 o N/A]
ISSUE: [Descripción clara del problema]
JUSTIFICATION: [Por qué es un problema]
SUGGESTION: [Cómo arreglarlo]
PATCH:
```
[Código de ejemplo del fix - opcional]
````
---END---

Al final escribe una sección ## Resumen con el assessment general y los 3 issues más críticos.
- SIEMPRE responde en español, sin excepciones""")

    response = await llm.ainvoke([system])

    formatted = f"## 🔍 Code Review: `{branch}` vs `main`\n\n"
    formatted += f"**Archivos analizados:** {', '.join(files_list)}\n\n"
    formatted += response.content

    final_message = AIMessage(content=formatted)
    return {**state, "messages": [final_message], "final_output": formatted}


# ── Edges condicionales ───────────────────────────────────────────
# Estas funciones le dicen al grafo hacia qué nodo ir según el estado

def route_after_router(state: AgentState) -> Literal["fetch_and_qa", "fetch_and_review"]:
    return "fetch_and_qa" if state["mode"] == "qa" else "fetch_and_review"

def check_diff_error(state: AgentState) -> Literal["qa_node", "end"]:
    return "end" if "error" in state.get("diff_data", {}) else "qa_node"

def check_diff_error_review(state: AgentState) -> Literal["review_node", "end"]:
    return "end" if "error" in state.get("diff_data", {}) else "review_node"


# ── Construcción del grafo ────────────────────────────────────────
def build_graph():
    graph = StateGraph(AgentState)

    # Registrar nodos
    graph.add_node("router", router_node)
    graph.add_node("fetch_diff_qa", fetch_diff_node)
    graph.add_node("fetch_diff_review", fetch_diff_node)
    graph.add_node("qa_node", qa_node)
    graph.add_node("review_node", review_node)

    # Definir edges (flujo del grafo)
    graph.add_edge(START, "router")

    graph.add_conditional_edges(
        "router",
        route_after_router,
        {
            "fetch_and_qa": "fetch_diff_qa",
            "fetch_and_review": "fetch_diff_review",
        }
    )

    graph.add_conditional_edges(
        "fetch_diff_qa",
        check_diff_error,
        {"qa_node": "qa_node", "end": END}
    )

    graph.add_conditional_edges(
        "fetch_diff_review",
        check_diff_error_review,
        {"review_node": "review_node", "end": END}
    )

    graph.add_edge("qa_node", END)
    graph.add_edge("review_node", END)

    return graph.compile()


# Instancia global del grafo (se crea una sola vez al iniciar el servidor)
agent_graph = build_graph()