import os
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

from agent.state import AgentState
from agent.github_tools import get_branch_diff, get_file_content

llm = ChatOpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.getenv("OPENROUTER_API_KEY"),
    model="google/gemini-2.0-flash-001",
    temperature=0.2,
)


async def router_node(state: AgentState) -> AgentState:
    last_message = state["messages"][-1].content

    system = SystemMessage(content="""Eres un router para un agente de code review.
Clasifica la intención del usuario en exactamente una de:
- "review": El usuario quiere un code review completo de la rama
- "qa": El usuario quiere hacer una pregunta específica sobre el código

Responde ÚNICAMENTE con la palabra "review" o "qa". Nada más.""")

    response = await llm.ainvoke([system, HumanMessage(content=last_message)])
    mode = response.content.strip().lower()

    if mode not in ["review", "qa"]:
        mode = "qa"

    return {**state, "mode": mode}


async def fetch_diff_node(state: AgentState) -> AgentState:
    branch = state["branch"]
    diff_data = await get_branch_diff(branch)

    if "error" in diff_data:
        error_msg = AIMessage(content=f"❌ Error: {diff_data['error']}")
        return {**state, "messages": [error_msg], "diff_data": diff_data}

    file_contents = {}
    for f in diff_data.get("files", []):
        filepath = f["filename"]
        content = await get_file_content(filepath, branch)
        file_contents[filepath] = content

    return {**state, "diff_data": diff_data, "file_contents": file_contents}


async def qa_node(state: AgentState) -> AgentState:
    question = state["messages"][-1].content
    branch = state["branch"]
    diff_data = state.get("diff_data", {})
    file_contents = state.get("file_contents", {})

    context_parts = []
    for filename, content in file_contents.items():
        truncated = content[:3000] + "\n[... truncado ...]" if len(content) > 3000 else content
        context_parts.append(f"### Archivo: {filename}\n```\n{truncated}\n```")

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

INSTRUCCIONES:
- Analiza el código disponible aunque sea parcial
- Para complejidad ciclomática: cuenta los if, for, switch, case, &&, ||
- Nunca digas que no puedes analizar — siempre responde basándote en el código visible
- Incluye rutas de archivos y números de línea cuando sea relevante
- SIEMPRE responde en español, sin excepciones""")

    response = await llm.ainvoke([system, HumanMessage(content=question)])
    return {**state, "messages": [response]}


async def review_node(state: AgentState) -> AgentState:
    diff_data = state.get("diff_data", {})
    file_contents = state.get("file_contents", {})
    branch = state["branch"]

    if "error" in diff_data:
        msg = AIMessage(content=f"❌ No se puede hacer el review: {diff_data['error']}")
        return {**state, "messages": [msg]}

    if not diff_data.get("files"):
        msg = AIMessage(content="⚠️ No hay archivos cambiados entre esta rama y main.")
        return {**state, "messages": [msg]}

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

Para cada problema encontrado usa EXACTAMENTE este formato:

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

Al final escribe ## Resumen con el assessment general y los 3 issues más críticos.
SIEMPRE responde en español, sin excepciones.""")

    response = await llm.ainvoke([system])

    formatted = f"## 🔍 Code Review: `{branch}` vs `main`\n\n"
    formatted += f"**Archivos analizados:** {', '.join(files_list)}\n\n"
    formatted += response.content

    final_message = AIMessage(content=formatted)
    return {**state, "messages": [final_message], "final_output": formatted}