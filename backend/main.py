import os
import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv

# load_dotenv() lee el archivo .env y carga las variables
# Debe ir ANTES de importar el grafo, porque el grafo usa os.getenv()
load_dotenv()

from agent.graph import agent_graph, AgentState
from langchain_core.messages import HumanMessage, AIMessage

app = FastAPI(title="Code Review Agent")

# Equivalente a cors() en Express
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
class ChatRequest(BaseModel):
    message: str
    branch: str
    history: list[dict] = []

@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/branches")
async def list_branches():
    return {
        "branches": [
            {"name": "feat/partiql-support",    "pr": "PR #1 - PartiQL support"},
            {"name": "feat/support-batch-read-ops", "pr": "PR #3 - Batch read ops"},
            {"name": "feat/support-streaming",  "pr": "PR #2 - DynamoDB Streams"},
        ]
    }


@app.post("/chat")
async def chat(req: ChatRequest):
    if not req.branch:
        raise HTTPException(status_code=400, detail="Branch es requerida.")

    # Reconstruimos el historial de mensajes en formato LangChain
    history_messages = []
    for msg in req.history:
        if msg["role"] == "user":
            history_messages.append(HumanMessage(content=msg["content"]))
        else:
            history_messages.append(AIMessage(content=msg["content"]))

    history_messages.append(HumanMessage(content=req.message))

    # Estado inicial del grafo
    initial_state: AgentState = {
        "messages": history_messages,
        "branch": req.branch,
        "mode": "unknown",
        "diff_data": {},
        "file_contents": {},
        "final_output": "",
    }

    try:
        result = await agent_graph.ainvoke(initial_state)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error del agente: {str(e)}")

    # Tomamos el último mensaje del agente
    ai_messages = [m for m in result["messages"] if isinstance(m, AIMessage)]
    if not ai_messages:
        raise HTTPException(status_code=500, detail="Sin respuesta del agente.")

    return {
        "response": ai_messages[-1].content,
        "mode": result.get("mode", "unknown"),
    }

@app.post("/chat/stream")
async def chat_stream(req: ChatRequest):

    history_messages = []
    for msg in req.history:
        if msg["role"] == "user":
            history_messages.append(HumanMessage(content=msg["content"]))
        else:
            history_messages.append(AIMessage(content=msg["content"]))
    history_messages.append(HumanMessage(content=req.message))

    initial_state: AgentState = {
        "messages": history_messages,
        "branch": req.branch,
        "mode": "unknown",
        "diff_data": {},
        "file_contents": {},
        "final_output": "",
    }

    async def generate():                                        # indentado 4 espacios
        try:
            async for event in agent_graph.astream_events(initial_state, version="v2"):
                kind = event["event"]
                metadata = event.get("metadata", {})
                langgraph_node = metadata.get("langgraph_node", "")

                if kind == "on_chat_model_stream":
                    if langgraph_node in ["qa_node", "review_node"]:
                        chunk = event["data"]["chunk"]
                        if chunk.content:
                            data = json.dumps({"type": "token", "content": chunk.content})
                            yield f"data: {data}\n\n"

                elif kind == "on_chain_start":
                    name = event.get("name", "")
                    if name in ["router", "fetch_diff_qa", "fetch_diff_review", "qa_node", "review_node"]:
                        data = json.dumps({"type": "status", "node": name})
                        yield f"data: {data}\n\n"

            yield f"data: {json.dumps({'type': 'done'})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    # ← Este return está FUERA de generate(), al mismo nivel que "async def generate()"
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )