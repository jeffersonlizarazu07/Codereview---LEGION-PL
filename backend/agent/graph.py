from typing import Literal
from langgraph.graph import END, START, StateGraph

from agent.state import AgentState
from agent.nodes import router_node, fetch_diff_node, qa_node, review_node


def route_after_router(state: AgentState) -> Literal["fetch_and_qa", "fetch_and_review"]:
    return "fetch_and_qa" if state["mode"] == "qa" else "fetch_and_review"


def check_diff_error(state: AgentState) -> Literal["qa_node", "end"]:
    return "end" if "error" in state.get("diff_data", {}) else "qa_node"


def check_diff_error_review(state: AgentState) -> Literal["review_node", "end"]:
    return "end" if "error" in state.get("diff_data", {}) else "review_node"


def build_graph():
    graph = StateGraph(AgentState)

    graph.add_node("router", router_node)
    
    """
    Se registran dos nodos fetch separados con la misma función para que el streaming pueda identificar el nodo por nombre y mostrar el status correcto en el frontend
    """
    graph.add_node("fetch_diff_qa", fetch_diff_node)
    graph.add_node("fetch_diff_review", fetch_diff_node)
    graph.add_node("qa_node", qa_node)
    graph.add_node("review_node", review_node)

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


agent_graph = build_graph()