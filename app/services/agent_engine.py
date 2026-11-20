from typing import Annotated, TypedDict

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode, tools_condition
from langchain_core.tools import tool

from app.core.config import settings
from app.core.exceptions import AppException
from app.services.rag_service import search_knowledge


@tool
def book_appointment(time: str, reason: str) -> str:
    """Record an appointment request. This does not check a live calendar."""
    return f"Recorded appointment request for {time}. Reason: {reason}."


@tool
def escalate_to_human(reason: str) -> str:
    """Hand the conversation to a human. Use this when the person asks for a human or the request cannot be resolved."""
    return f"Escalated to a human. Reason: {reason}."


TOOLS = [book_appointment, escalate_to_human]


class AgentState(TypedDict):
    messages: Annotated[list, add_messages]
    user_id: str
    agent_id: str
    context: str
    system_prompt: str
    model: str


def _chat_model(model_name: str):
    if model_name.startswith("claude"):
        if not settings.ANTHROPIC_API_KEY:
            raise AppException("ANTHROPIC_API_KEY is required for this model", status_code=503)
        from langchain_anthropic import ChatAnthropic

        return ChatAnthropic(model=model_name, api_key=settings.ANTHROPIC_API_KEY)
    if not settings.GEMINI_API_KEY:
        raise AppException("GEMINI_API_KEY is required for this model", status_code=503)
    from langchain_google_genai import ChatGoogleGenerativeAI

    return ChatGoogleGenerativeAI(model=model_name, google_api_key=settings.GEMINI_API_KEY)


async def retrieve(state: AgentState) -> dict:
    question = ""
    for message in reversed(state["messages"]):
        if isinstance(message, HumanMessage):
            question = message.content if isinstance(message.content, str) else str(message.content)
            break
    context = await search_knowledge(state["user_id"], state["agent_id"], question)
    return {"context": context}


async def call_model(state: AgentState) -> dict:
    knowledge = state["context"] or "No knowledge was retrieved for this tenant and agent."
    system = (
        f"{state['system_prompt']}\n\n"
        "Retrieved knowledge:\n"
        f"{knowledge}\n\n"
        "Use a tool only when it matches the request. Do not invent tool results."
    )
    model = _chat_model(state["model"]).bind_tools(TOOLS)
    response = await model.ainvoke([SystemMessage(content=system), *state["messages"]])
    return {"messages": [response]}


def build_agent():
    graph = StateGraph(AgentState)
    graph.add_node("retrieve", retrieve)
    graph.add_node("llm", call_model)
    graph.add_node("tools", ToolNode(TOOLS))
    graph.add_edge(START, "retrieve")
    graph.add_edge("retrieve", "llm")
    graph.add_conditional_edges("llm", tools_condition, {"tools": "tools", END: END})
    graph.add_edge("tools", "llm")
    return graph.compile()


_agent = None


def get_agent():
    global _agent
    if _agent is None:
        _agent = build_agent()
    return _agent


def _message_text(content: object) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for part in content:
            if isinstance(part, str):
                parts.append(part)
            elif isinstance(part, dict) and part.get("type") == "text":
                parts.append(str(part.get("text") or ""))
            elif getattr(part, "type", "text") == "text" and getattr(part, "text", None):
                parts.append(str(part.text))
        return "".join(parts).strip()
    return str(content)


def reply_text(messages: list) -> str:
    for message in reversed(messages):
        if isinstance(message, AIMessage) and message.content and not message.tool_calls:
            return _message_text(message.content)
    return ""
