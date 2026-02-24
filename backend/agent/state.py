from typing import Annotated, Literal, TypedDict
from langgraph.graph.message import add_messages

class AgentState(TypedDict):
    messages: Annotated[list, add_messages]
    branch: str
    mode: Literal["qa", "review", "unknown"]
    diff_data: dict
    file_contents: dict
    final_output: str