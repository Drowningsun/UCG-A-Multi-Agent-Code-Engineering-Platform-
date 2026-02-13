# AG-UI Protocol Implementation
# Implements the Agent-User Interaction Protocol (https://docs.ag-ui.com)
# Standardized event-based communication between AI agents and frontend UI
#
# Event Types (per AG-UI spec):
#   Lifecycle: RUN_STARTED, RUN_FINISHED, RUN_ERROR, STEP_STARTED, STEP_FINISHED
#   Text:      TEXT_MESSAGE_START, TEXT_MESSAGE_CONTENT, TEXT_MESSAGE_END
#   Tool:      TOOL_CALL_START, TOOL_CALL_ARGS, TOOL_CALL_END, TOOL_CALL_RESULT
#   State:     STATE_SNAPSHOT, STATE_DELTA, MESSAGES_SNAPSHOT
#   Special:   RAW, CUSTOM

from enum import Enum
from typing import Optional, List, Dict, Any, Union
from pydantic import BaseModel, Field
from datetime import datetime
import json
import uuid


# ==================== AG-UI Event Types (Standard) ====================

class EventType(str, Enum):
    """Standard AG-UI event types as defined by the protocol specification."""

    # Lifecycle Events
    RUN_STARTED = "RUN_STARTED"
    RUN_FINISHED = "RUN_FINISHED"
    RUN_ERROR = "RUN_ERROR"
    STEP_STARTED = "STEP_STARTED"
    STEP_FINISHED = "STEP_FINISHED"

    # Text Message Events
    TEXT_MESSAGE_START = "TEXT_MESSAGE_START"
    TEXT_MESSAGE_CONTENT = "TEXT_MESSAGE_CONTENT"
    TEXT_MESSAGE_END = "TEXT_MESSAGE_END"

    # Tool Call Events
    TOOL_CALL_START = "TOOL_CALL_START"
    TOOL_CALL_ARGS = "TOOL_CALL_ARGS"
    TOOL_CALL_END = "TOOL_CALL_END"
    TOOL_CALL_RESULT = "TOOL_CALL_RESULT"

    # State Management Events
    STATE_SNAPSHOT = "STATE_SNAPSHOT"
    STATE_DELTA = "STATE_DELTA"
    MESSAGES_SNAPSHOT = "MESSAGES_SNAPSHOT"

    # Special Events
    RAW = "RAW"
    CUSTOM = "CUSTOM"


# ==================== Base Event ====================

class BaseEvent(BaseModel):
    """
    Base event following AG-UI protocol spec.
    All events share: type, timestamp, rawEvent (optional).
    """
    type: EventType
    timestamp: Optional[float] = Field(default_factory=lambda: datetime.now().timestamp())
    rawEvent: Optional[Dict[str, Any]] = None

    class Config:
        use_enum_values = True

    def to_sse(self) -> str:
        """Serialize to Server-Sent Event format."""
        return f"data: {self.model_dump_json()}\n\n"


# ==================== Lifecycle Events ====================

class RunStartedEvent(BaseEvent):
    """Signals the start of an agent run."""
    type: EventType = EventType.RUN_STARTED
    threadId: str
    runId: str
    parentRunId: Optional[str] = None
    input: Optional[Dict[str, Any]] = None


class RunFinishedEvent(BaseEvent):
    """Signals the successful completion of an agent run."""
    type: EventType = EventType.RUN_FINISHED
    threadId: str
    runId: str
    result: Optional[Dict[str, Any]] = None


class RunErrorEvent(BaseEvent):
    """Signals an error during an agent run."""
    type: EventType = EventType.RUN_ERROR
    message: str
    code: Optional[str] = None


class StepStartedEvent(BaseEvent):
    """Signals the start of a step within an agent run."""
    type: EventType = EventType.STEP_STARTED
    stepName: str


class StepFinishedEvent(BaseEvent):
    """Signals the completion of a step within an agent run."""
    type: EventType = EventType.STEP_FINISHED
    stepName: str


# ==================== Text Message Events ====================

class TextMessageStartEvent(BaseEvent):
    """Signals the start of a text message."""
    type: EventType = EventType.TEXT_MESSAGE_START
    messageId: str
    role: str = "assistant"


class TextMessageContentEvent(BaseEvent):
    """Represents a chunk of content in a streaming text message."""
    type: EventType = EventType.TEXT_MESSAGE_CONTENT
    messageId: str
    delta: str


class TextMessageEndEvent(BaseEvent):
    """Signals the end of a text message."""
    type: EventType = EventType.TEXT_MESSAGE_END
    messageId: str


# ==================== Tool Call Events ====================

class ToolCallStartEvent(BaseEvent):
    """Signals the start of a tool call (agent fix/analysis)."""
    type: EventType = EventType.TOOL_CALL_START
    toolCallId: str
    toolCallName: str
    parentMessageId: Optional[str] = None


class ToolCallArgsEvent(BaseEvent):
    """Represents a chunk of argument data for a tool call."""
    type: EventType = EventType.TOOL_CALL_ARGS
    toolCallId: str
    delta: str


class ToolCallEndEvent(BaseEvent):
    """Signals the end of a tool call."""
    type: EventType = EventType.TOOL_CALL_END
    toolCallId: str


class ToolCallResultEvent(BaseEvent):
    """Provides the result of a tool call execution."""
    type: EventType = EventType.TOOL_CALL_RESULT
    messageId: Optional[str] = None
    toolCallId: str
    content: str
    role: str = "tool"


# ==================== State Management Events ====================

class StateSnapshotEvent(BaseEvent):
    """Provides a complete snapshot of an agent's state."""
    type: EventType = EventType.STATE_SNAPSHOT
    snapshot: Dict[str, Any]


class StateDeltaEvent(BaseEvent):
    """Provides a partial update using JSON Patch operations (RFC 6902)."""
    type: EventType = EventType.STATE_DELTA
    delta: List[Dict[str, Any]]


class MessagesSnapshotEvent(BaseEvent):
    """Provides a snapshot of all messages in a conversation."""
    type: EventType = EventType.MESSAGES_SNAPSHOT
    messages: List[Dict[str, Any]]


# ==================== Special Events ====================

class RawEvent(BaseEvent):
    """Pass-through events from external systems."""
    type: EventType = EventType.RAW
    event: Dict[str, Any]
    source: Optional[str] = None


class CustomEvent(BaseEvent):
    """Application-specific custom events."""
    type: EventType = EventType.CUSTOM
    name: str
    value: Dict[str, Any]


# ==================== Domain-Specific Models ====================

class Severity(str, Enum):
    """Severity levels for code issues."""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class AgentPhase(str, Enum):
    """Phases of agent execution."""
    IDLE = "idle"
    STARTING = "starting"
    ANALYZING = "analyzing"
    PROCESSING = "processing"
    FIXING = "fixing"
    COMPLETE = "complete"
    ERROR = "error"


class FixSpec(BaseModel):
    """Specification for a code fix applied by an agent."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    agent: str
    description: str
    severity: str = "medium"
    category: Optional[str] = None
    line: Optional[int] = None
    before: Optional[str] = None
    after: Optional[str] = None
    applied: bool = True


class WorkflowStep(BaseModel):
    """Specification for a workflow step."""
    id: str
    name: str
    icon: str
    status: str
    message: Optional[str] = None
    duration: Optional[float] = None


# ==================== AG-UI Event Factory ====================

class AGUIEvents:
    """
    Factory class for creating AG-UI protocol events.

    Usage:
        events = AGUIEvents(thread_id="session_123", run_id="run_456")
        yield events.run_started().to_sse()
        yield events.step_started("code_generator").to_sse()
        yield events.text_message_start("msg_1").to_sse()
        yield events.text_message_content("msg_1", "chunk").to_sse()
        yield events.text_message_end("msg_1").to_sse()
        yield events.step_finished("code_generator").to_sse()
        yield events.run_finished().to_sse()
    """

    def __init__(self, thread_id: str = None, run_id: str = None):
        self.thread_id = thread_id or str(uuid.uuid4())
        self.run_id = run_id or str(uuid.uuid4())

    # --- Lifecycle ---

    def run_started(self, input_data: Dict[str, Any] = None) -> RunStartedEvent:
        return RunStartedEvent(
            threadId=self.thread_id,
            runId=self.run_id,
            input=input_data
        )

    def run_finished(self, result: Dict[str, Any] = None) -> RunFinishedEvent:
        return RunFinishedEvent(
            threadId=self.thread_id,
            runId=self.run_id,
            result=result
        )

    def run_error(self, message: str, code: str = None) -> RunErrorEvent:
        return RunErrorEvent(message=message, code=code)

    def step_started(self, step_name: str) -> StepStartedEvent:
        return StepStartedEvent(stepName=step_name)

    def step_finished(self, step_name: str) -> StepFinishedEvent:
        return StepFinishedEvent(stepName=step_name)

    # --- Text Messages ---

    def text_message_start(self, message_id: str, role: str = "assistant") -> TextMessageStartEvent:
        return TextMessageStartEvent(messageId=message_id, role=role)

    def text_message_content(self, message_id: str, delta: str) -> TextMessageContentEvent:
        return TextMessageContentEvent(messageId=message_id, delta=delta)

    def text_message_end(self, message_id: str) -> TextMessageEndEvent:
        return TextMessageEndEvent(messageId=message_id)

    # --- Tool Calls ---

    def tool_call_start(self, tool_call_id: str, tool_name: str, parent_message_id: str = None) -> ToolCallStartEvent:
        return ToolCallStartEvent(
            toolCallId=tool_call_id,
            toolCallName=tool_name,
            parentMessageId=parent_message_id
        )

    def tool_call_args(self, tool_call_id: str, delta: str) -> ToolCallArgsEvent:
        return ToolCallArgsEvent(toolCallId=tool_call_id, delta=delta)

    def tool_call_end(self, tool_call_id: str) -> ToolCallEndEvent:
        return ToolCallEndEvent(toolCallId=tool_call_id)

    def tool_call_result(self, tool_call_id: str, content: str, message_id: str = None) -> ToolCallResultEvent:
        return ToolCallResultEvent(
            toolCallId=tool_call_id,
            content=content,
            messageId=message_id
        )

    # --- State Management ---

    def state_snapshot(self, snapshot: Dict[str, Any]) -> StateSnapshotEvent:
        return StateSnapshotEvent(snapshot=snapshot)

    def state_delta(self, operations: List[Dict[str, Any]]) -> StateDeltaEvent:
        return StateDeltaEvent(delta=operations)

    def messages_snapshot(self, messages: List[Dict[str, Any]]) -> MessagesSnapshotEvent:
        return MessagesSnapshotEvent(messages=messages)

    # --- Special Events ---

    def raw(self, event: Dict[str, Any], source: str = None) -> RawEvent:
        return RawEvent(event=event, source=source)

    def custom(self, name: str, value: Dict[str, Any]) -> CustomEvent:
        return CustomEvent(name=name, value=value)

    # --- Convenience: Domain-specific Custom Events ---

    def workflow_update(self, steps: list) -> CustomEvent:
        """Emit workflow update as CUSTOM event."""
        return self.custom(
            name="workflow_update",
            value={"steps": [s.model_dump() if hasattr(s, "model_dump") else s for s in steps]}
        )

    def agent_activity(self, agent_name: str, icon: str, phase: str,
                       message: str, progress: int = None,
                       stats: Dict[str, Any] = None) -> CustomEvent:
        """Emit agent activity status as CUSTOM event."""
        return self.custom(
            name="agent_activity",
            value={
                "agentName": agent_name,
                "icon": icon,
                "phase": phase,
                "message": message,
                "progress": progress,
                "stats": stats or {}
            }
        )

    def code_update(self, code: str, source: str,
                    fixes: list = None, fix_count: int = 0) -> CustomEvent:
        """Emit code update with fixes as CUSTOM event."""
        return self.custom(
            name="code_update",
            value={
                "code": code,
                "source": source,
                "fixCount": fix_count or (len(fixes) if fixes else 0),
                "fixes": [f.model_dump() for f in (fixes or [])]
            }
        )

    def agent_result(self, agent_name: str, icon: str, data: Dict[str, Any],
                     fixes: list = None, stats: Dict[str, Any] = None) -> CustomEvent:
        """Emit agent result as CUSTOM event."""
        return self.custom(
            name="agent_result",
            value={
                "agentName": agent_name,
                "icon": icon,
                "data": data,
                "fixes": [f.model_dump() for f in (fixes or [])],
                "stats": stats or {}
            }
        )

    # --- Multi-File Project Events ---

    def project_plan(self, plan: Dict[str, Any]) -> CustomEvent:
        """Emit project plan (file tree) as CUSTOM event."""
        return self.custom(
            name="project_plan",
            value=plan
        )

    def file_started(self, file_path: str, language: str,
                     purpose: str = "", file_index: int = 0,
                     total_files: int = 0) -> CustomEvent:
        """Emit file generation started as CUSTOM event."""
        return self.custom(
            name="file_started",
            value={
                "path": file_path,
                "language": language,
                "purpose": purpose,
                "fileIndex": file_index,
                "totalFiles": total_files
            }
        )

    def file_completed(self, file_path: str, content: str,
                       lines: int = 0, language: str = "") -> CustomEvent:
        """Emit file generation completed as CUSTOM event."""
        return self.custom(
            name="file_completed",
            value={
                "path": file_path,
                "content": content,
                "lines": lines,
                "language": language
            }
        )

    def file_updated(self, file_path: str, content: str,
                     fixes: list = None, fix_count: int = 0) -> CustomEvent:
        """Emit file updated (after agent fixes) as CUSTOM event."""
        return self.custom(
            name="file_updated",
            value={
                "path": file_path,
                "content": content,
                "fixCount": fix_count or (len(fixes) if fixes else 0),
                "fixes": [f.model_dump() for f in (fixes or [])]
            }
        )


# ==================== Helper Functions ====================

def create_fix_spec(agent, description, severity="medium",
                    before=None, after=None, line=None, category=None):
    """Helper to create a FixSpec from agent output."""
    return FixSpec(
        agent=agent,
        description=description,
        severity=severity.lower() if severity else "medium",
        before=before,
        after=after,
        line=line,
        category=category
    )


def get_agent_icon(agent_id: str) -> str:
    """Get icon for an agent by ID."""
    icons = {
        "code_generator": "",
        "validator": "",
        "testing": "",
        "security": ""
    }
    return icons.get(agent_id.lower(), "")


def new_id() -> str:
    """Generate a short unique ID."""
    return str(uuid.uuid4())[:8]
