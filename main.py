# Entry point for Uber Code Generator API with AG-UI Protocol - FastAPI Version
# Implements the Agent-User Interaction Protocol (https://docs.ag-ui.com)
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from contextlib import asynccontextmanager
from datetime import datetime
from pydantic import BaseModel
from typing import Optional, List
import json
import time
import uuid

from config import settings
from database import connect_to_mongo, close_mongo_connection, SessionDB, MessageDB
from auth import router as auth_router, get_current_user, get_optional_user
from orchestrator import Orchestrator
from agui_protocol import (
    AGUIEvents, EventType, AgentPhase, Severity,
    FixSpec, WorkflowStep, create_fix_spec, get_agent_icon, new_id
)


# Lifespan for startup/shutdown events
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await connect_to_mongo()
    yield
    # Shutdown
    await close_mongo_connection()


# FastAPI app
app = FastAPI(
    title="Uber Code Generator API",
    description="AI-powered code generation with multi-agent validation",
    version="2.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include auth router
app.include_router(auth_router)


# Pydantic Schemas (Request/Response models with automatic validation)
class GenerateRequest(BaseModel):
    prompt: str
    session_id: Optional[str] = None
    api_key: Optional[str] = None
    context_code: Optional[str] = None  # Previous code for follow-up prompts


class EditRequest(BaseModel):
    original_code: str
    updates: List[dict] = []


class RegenerateRequest(BaseModel):
    original_prompt: str = ""
    edit_instructions: str
    current_code: str = ""
    api_key: Optional[str] = None


class SessionResponse(BaseModel):
    session_id: str
    created_at: str


class HealthResponse(BaseModel):
    status: str
    message: str


# API Routes
@app.get("/api/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "message": "Uber Code Generator API (FastAPI + MongoDB)"}


@app.post("/api/generate")
async def generate_code(request: GenerateRequest, user: Optional[dict] = Depends(get_optional_user)):
    """Generate code from a prompt (non-streaming)"""
    if not request.prompt:
        raise HTTPException(status_code=400, detail="Prompt is required")
    
    # Use API key from request or from settings
    api_key = request.api_key or settings.GROQ_API_KEY
    orchestrator = Orchestrator(api_key)
    result = orchestrator.run_workflow(request.prompt)
    
    # Save to session if provided
    if request.session_id:
        try:
            await MessageDB.add_message(
                session_id=request.session_id,
                role='user',
                content=request.prompt
            )
            await MessageDB.add_message(
                session_id=request.session_id,
                role='assistant',
                content="Code generated",
                code_output=result.get('code'),
                workflow_data=result.get('workflow')
            )
        except Exception as e:
            print(f"Session save error: {e}")
    
    return result


@app.post("/api/generate/stream")
async def generate_code_stream(request: GenerateRequest):
    """
    AG-UI Protocol streaming endpoint.
    Supports both single-file and multi-file generation.
    Smart detection: classifies the prompt to determine mode.
    
    Events emitted:
      Lifecycle: RUN_STARTED, STEP_STARTED/FINISHED, RUN_FINISHED
      Text:      TEXT_MESSAGE_START/CONTENT/END (per-file streaming)
      Tool:      TOOL_CALL_START/ARGS/END/RESULT (agent fixes)
      State:     STATE_SNAPSHOT, STATE_DELTA
      Custom:    project_plan, file_started, file_completed, file_updated,
                 workflow_update, agent_activity, code_update, agent_result
    """
    if not request.prompt:
        raise HTTPException(status_code=400, detail="Prompt is required")

    orchestrator = Orchestrator(request.api_key)

    # Build enhanced prompt with context if previous code exists
    enhanced_prompt = request.prompt
    if request.context_code:
        enhanced_prompt = f"""Previous code that was generated:
```
{request.context_code}
```

User's follow-up request: {request.prompt}

Please modify or rewrite the above code according to the user's request."""

    async def generate():
        # Initialize AG-UI event factory
        thread_id = request.session_id or str(uuid.uuid4())
        run_id = str(uuid.uuid4())
        ev = AGUIEvents(thread_id=thread_id, run_id=run_id)

        start_time = time.time()

        # ===== RUN_STARTED =====
        yield ev.run_started(input_data={"prompt": request.prompt}).to_sse()

        # ===== STEP 0: CLASSIFY (smart detection) =====
        yield ev.step_started("classifier").to_sse()
        yield ev.agent_activity(
            agent_name="Project Planner", icon="📋",
            phase="analyzing", message="🔍 Analyzing project scope..."
        ).to_sse()

        # Always classify the prompt first
        classification = orchestrator.classify_prompt(request.prompt)
        mode = classification.get("mode", "single")

        # If classified as multi-file, ignore context_code (it's a new project)
        if mode == "multi" and request.context_code:
            enhanced_prompt = request.prompt
        yield ev.step_finished("classifier").to_sse()

        yield ev.agent_activity(
            agent_name="Project Planner", icon="📋",
            phase="complete",
            message=f"{'📁 Multi-file project detected' if mode == 'multi' else '📄 Single-file generation'}"
        ).to_sse()

        # Initial state snapshot
        yield ev.state_snapshot(snapshot={
            "mode": mode,
            "phase": "starting"
        }).to_sse()

        if mode == "multi":
            # ===== MULTI-FILE GENERATION =====
            for event in _generate_multi_file(ev, orchestrator, enhanced_prompt, request.prompt, start_time):
                yield event
        else:
            # ===== SINGLE-FILE GENERATION (existing flow) =====
            for event in _generate_single_file(ev, orchestrator, enhanced_prompt, request.prompt, start_time):
                yield event

    return StreamingResponse(generate(), media_type="text/event-stream")


def _generate_single_file(ev, orchestrator, enhanced_prompt, original_prompt, start_time):
    """Single-file generation — existing flow with AG-UI events."""
    full_code = ""
    current_code = ""
    original_code = ""
    all_fixes = []
    workflow_steps = [
        {"id": "code_gen", "name": "Code Generator", "icon": "⚡", "status": "pending"},
        {"id": "validator", "name": "Validator", "icon": "✓", "status": "pending"},
        {"id": "testing", "name": "Testing", "icon": "🧪", "status": "pending"},
        {"id": "security", "name": "Security", "icon": "🛡️", "status": "pending"}
    ]

    # ===== STEP 1: CODE GENERATOR =====
    yield ev.step_started("code_generator").to_sse()
    workflow_steps[0]["status"] = "active"
    yield ev.workflow_update(workflow_steps).to_sse()

    yield ev.agent_activity(
        agent_name="Code Generator", icon="⚡",
        phase="starting", message="🚀 Generating code from your prompt..."
    ).to_sse()

    code_msg_id = f"code_{new_id()}"
    yield ev.text_message_start(code_msg_id, role="assistant").to_sse()

    gen_start = time.time()
    line_count = 0

    for chunk in orchestrator.generate_code_stream(enhanced_prompt):
        full_code += chunk
        line_count = len(full_code.splitlines())
        yield ev.text_message_content(code_msg_id, delta=chunk).to_sse()

    yield ev.text_message_end(code_msg_id).to_sse()

    gen_duration = time.time() - gen_start
    original_code = full_code
    current_code = full_code

    yield ev.state_delta([
        {"op": "replace", "path": "/code", "value": full_code},
        {"op": "replace", "path": "/phase", "value": "validating"}
    ]).to_sse()

    workflow_steps[0]["status"] = "complete"
    workflow_steps[0]["duration"] = round(gen_duration, 2)
    yield ev.step_finished("code_generator").to_sse()
    yield ev.workflow_update(workflow_steps).to_sse()

    yield ev.agent_activity(
        agent_name="Code Generator", icon="⚡",
        phase="complete",
        message=f"Generated {line_count} lines of code",
        stats={"lines": line_count, "chars": len(full_code), "duration": round(gen_duration, 2)}
    ).to_sse()

    # ===== Helper: Process agent fixes =====
    def process_agent_fixes(agent_name, agent_icon, result_data, category, default_severity="medium"):
        nonlocal current_code
        fixes = []
        events_to_yield = []

        if result_data.get('fixed_code') and result_data.get('fixes_applied'):
            current_code = result_data['fixed_code']

            for fix in result_data['fixes_applied']:
                if isinstance(fix, dict):
                    fix_spec = create_fix_spec(
                        agent=agent_name,
                        description=fix.get('description', str(fix)),
                        severity=fix.get('severity', default_severity),
                        before=fix.get('before'),
                        after=fix.get('after'),
                        line=fix.get('line'),
                        category=category
                    )
                else:
                    fix_spec = create_fix_spec(
                        agent=agent_name,
                        description=str(fix),
                        severity=default_severity
                    )
                fixes.append(fix_spec)

            all_fixes.append({'agent': agent_name, 'fixes': result_data['fixes_applied']})

            for fix_spec in fixes:
                tc_id = f"fix_{new_id()}"
                events_to_yield.append(ev.tool_call_start(tc_id, f"{agent_name.lower()}_fix", code_msg_id))
                events_to_yield.append(ev.tool_call_args(tc_id, json.dumps(fix_spec.model_dump())))
                events_to_yield.append(ev.tool_call_end(tc_id))
                events_to_yield.append(ev.tool_call_result(tc_id, json.dumps({
                    "applied": True, "description": fix_spec.description
                }), message_id=code_msg_id))

            events_to_yield.append(ev.code_update(
                code=current_code, source=agent_name.lower(),
                fixes=fixes, fix_count=len(fixes)
            ))

        return fixes, events_to_yield

    # ===== STEP 2: VALIDATOR =====
    yield ev.step_started("validator").to_sse()
    workflow_steps[1]["status"] = "active"
    yield ev.workflow_update(workflow_steps).to_sse()

    yield ev.agent_activity(
        agent_name="Validator", icon="✓",
        phase="analyzing", message="✅ Analyzing code quality and style...",
        progress=30
    ).to_sse()

    validation = orchestrator.validate_code(current_code)
    val_duration = round(time.time() - (start_time + gen_duration), 2)

    val_fixes, val_events = process_agent_fixes("Validator", "✓", validation, "Code Quality")
    for e in val_events:
        yield e.to_sse()

    workflow_steps[1]["status"] = "complete"
    workflow_steps[1]["duration"] = val_duration
    yield ev.step_finished("validator").to_sse()
    yield ev.workflow_update(workflow_steps).to_sse()

    yield ev.agent_result(
        agent_name="Validator", icon="✓", data=validation,
        fixes=val_fixes,
        stats={"issuesFound": len(validation.get('issues', [])), "fixesApplied": len(val_fixes), "duration": val_duration}
    ).to_sse()

    # ===== STEP 3: TESTING =====
    yield ev.step_started("testing").to_sse()
    workflow_steps[2]["status"] = "active"
    yield ev.workflow_update(workflow_steps).to_sse()

    yield ev.agent_activity(
        agent_name="Testing Agent", icon="🧪",
        phase="analyzing", message="🧪 Analyzing testability & error handling...",
        progress=50
    ).to_sse()

    test_step_start = time.time()
    tests = orchestrator.test_code(current_code)
    test_duration = round(time.time() - test_step_start, 2)

    test_fixes, test_events = process_agent_fixes("Testing", "🧪", tests, "Error Handling")
    for e in test_events:
        yield e.to_sse()

    workflow_steps[2]["status"] = "complete"
    workflow_steps[2]["duration"] = test_duration
    yield ev.step_finished("testing").to_sse()
    yield ev.workflow_update(workflow_steps).to_sse()

    yield ev.agent_result(
        agent_name="Testing Agent", icon="🧪", data=tests,
        fixes=test_fixes,
        stats={"testabilityScore": tests.get('testability_score', 'N/A'), "fixesApplied": len(test_fixes), "duration": test_duration}
    ).to_sse()

    # ===== STEP 4: SECURITY =====
    yield ev.step_started("security").to_sse()
    workflow_steps[3]["status"] = "active"
    yield ev.workflow_update(workflow_steps).to_sse()

    yield ev.agent_activity(
        agent_name="Security Agent", icon="🛡️",
        phase="analyzing", message="🛡️ Scanning for vulnerabilities...",
        progress=70
    ).to_sse()

    sec_step_start = time.time()
    security = orchestrator.secure_code(current_code)
    sec_duration = round(time.time() - sec_step_start, 2)

    sec_fixes, sec_events = process_agent_fixes("Security", "🛡️", security, "Security", "high")
    for e in sec_events:
        yield e.to_sse()

    workflow_steps[3]["status"] = "complete"
    workflow_steps[3]["duration"] = sec_duration
    yield ev.step_finished("security").to_sse()
    yield ev.workflow_update(workflow_steps).to_sse()

    yield ev.agent_result(
        agent_name="Security Agent", icon="🛡️", data=security,
        fixes=sec_fixes,
        stats={"riskLevel": security.get('risk_level', 'LOW'), "vulnerabilities": len(security.get('vulnerabilities', [])), "fixesApplied": len(sec_fixes), "duration": sec_duration}
    ).to_sse()

    # ===== FINAL =====
    total_duration = time.time() - start_time
    total_fixes = sum(len(f['fixes']) for f in all_fixes)
    code_was_fixed = current_code != original_code

    yield ev.state_snapshot(snapshot={
        "mode": "single",
        "code": current_code,
        "original_code": original_code if code_was_fixed else None,
        "prompt": original_prompt,
        "all_fixes": all_fixes,
        "total_fixes": total_fixes,
        "code_was_fixed": code_was_fixed,
        "workflow": workflow_steps,
        "stats": {"totalDuration": round(total_duration, 2), "totalLines": line_count, "totalFixes": total_fixes},
        "validation": validation,
        "tests": tests,
        "security": security,
        "phase": "complete"
    }).to_sse()

    yield ev.run_finished(result={
        "mode": "single",
        "code": current_code,
        "original_code": original_code if code_was_fixed else None,
        "prompt": original_prompt,
        "all_fixes": all_fixes,
        "total_fixes": total_fixes,
        "code_was_fixed": code_was_fixed,
        "workflow": workflow_steps,
        "stats": {"totalDuration": round(total_duration, 2), "totalLines": line_count, "totalFixes": total_fixes},
        "validation": validation,
        "tests": tests,
        "security": security
    }).to_sse()


def _generate_multi_file(ev, orchestrator, enhanced_prompt, original_prompt, start_time):
    """
    Multi-file project generation.
    Flow: Plan → Generate each file (streamed) → Validate/Test/Secure code files.
    """
    all_fixes = []

    # ===== STEP 1: PLANNING =====
    yield ev.step_started("planning").to_sse()

    workflow_steps = [
        {"id": "planning", "name": "Planning", "icon": "📋", "status": "active"},
        {"id": "generating", "name": "Generating", "icon": "⚡", "status": "pending"},
        {"id": "validator", "name": "Validator", "icon": "✓", "status": "pending"},
        {"id": "testing", "name": "Testing", "icon": "🧪", "status": "pending"},
        {"id": "security", "name": "Security", "icon": "🛡️", "status": "pending"}
    ]
    yield ev.workflow_update(workflow_steps).to_sse()

    yield ev.agent_activity(
        agent_name="Project Planner", icon="📋",
        phase="analyzing", message="📋 Planning project structure..."
    ).to_sse()

    plan_start = time.time()
    project_plan = orchestrator.plan_project(original_prompt)
    plan_duration = round(time.time() - plan_start, 2)

    # Emit project plan
    yield ev.project_plan(project_plan).to_sse()

    workflow_steps[0]["status"] = "complete"
    workflow_steps[0]["duration"] = plan_duration
    yield ev.step_finished("planning").to_sse()
    yield ev.workflow_update(workflow_steps).to_sse()

    file_count = len(project_plan.get("files", []))
    yield ev.agent_activity(
        agent_name="Project Planner", icon="📋",
        phase="complete",
        message=f"Planned {file_count} files for {project_plan.get('project_name', 'project')}",
        stats={"files": file_count, "duration": plan_duration}
    ).to_sse()

    # ===== STEP 2: GENERATE EACH FILE =====
    yield ev.step_started("generating").to_sse()
    workflow_steps[1]["status"] = "active"
    yield ev.workflow_update(workflow_steps).to_sse()

    generated_files = {}  # {path: content}
    total_lines = 0

    for idx, file_info in enumerate(project_plan.get("files", [])):
        file_path = file_info["path"]
        language = file_info.get("language", "text")

        # File started event
        yield ev.file_started(
            file_path=file_path,
            language=language,
            purpose=file_info.get("purpose", ""),
            file_index=idx,
            total_files=file_count
        ).to_sse()

        yield ev.agent_activity(
            agent_name="Code Generator", icon="⚡",
            phase="generating",
            message=f"⚡ Generating {file_path} ({idx + 1}/{file_count})...",
            progress=int((idx / file_count) * 100)
        ).to_sse()

        # Stream file content as TEXT_MESSAGE events
        file_msg_id = f"file_{new_id()}"
        yield ev.text_message_start(file_msg_id, role="assistant").to_sse()

        file_content = ""
        for chunk in orchestrator.generate_file_stream(
            original_prompt, file_info, project_plan, generated_files
        ):
            file_content += chunk
            yield ev.text_message_content(file_msg_id, delta=chunk).to_sse()

        yield ev.text_message_end(file_msg_id).to_sse()

        # Strip markdown fences if present
        file_content = _strip_fences(file_content)
        file_lines = len(file_content.splitlines())
        total_lines += file_lines
        generated_files[file_path] = file_content

        # File completed event
        yield ev.file_completed(
            file_path=file_path,
            content=file_content,
            lines=file_lines,
            language=language
        ).to_sse()

    gen_duration = round(time.time() - start_time - plan_duration, 2)
    workflow_steps[1]["status"] = "complete"
    workflow_steps[1]["duration"] = gen_duration
    yield ev.step_finished("generating").to_sse()
    yield ev.workflow_update(workflow_steps).to_sse()

    yield ev.agent_activity(
        agent_name="Code Generator", icon="⚡",
        phase="complete",
        message=f"Generated {file_count} files ({total_lines} total lines)",
        stats={"files": file_count, "totalLines": total_lines, "duration": gen_duration}
    ).to_sse()

    # Save originals for diff
    original_files = {k: v for k, v in generated_files.items()}

    # ===== STEP 3–5: VALIDATE / TEST / SECURE (code files only) =====
    code_extensions = {".py", ".js", ".jsx", ".ts", ".tsx"}
    code_files = [
        path for path in generated_files
        if any(path.endswith(ext) for ext in code_extensions)
    ]

    agent_steps = [
        ("validator", "Validator", "✓", "analyzing", "✅ Validating code quality...",
         lambda code: orchestrator.validate_file(code), "Code Quality", "medium", 2),
        ("testing", "Testing Agent", "🧪", "analyzing", "🧪 Checking testability...",
         lambda code: orchestrator.test_file(code), "Error Handling", "medium", 3),
        ("security", "Security Agent", "🛡️", "analyzing", "🛡️ Scanning for vulnerabilities...",
         lambda code: orchestrator.secure_file(code), "Security", "high", 4),
    ]

    for step_id, agent_name, icon, phase, message, run_fn, category, default_sev, ws_idx in agent_steps:
        yield ev.step_started(step_id).to_sse()
        workflow_steps[ws_idx]["status"] = "active"
        yield ev.workflow_update(workflow_steps).to_sse()

        yield ev.agent_activity(
            agent_name=agent_name, icon=icon,
            phase=phase, message=message,
            progress=30 + ws_idx * 20
        ).to_sse()

        step_start = time.time()
        step_fixes = []

        for file_path in code_files:
            code = generated_files[file_path]
            result_data = run_fn(code)

            if result_data.get('fixed_code') and result_data.get('fixes_applied'):
                generated_files[file_path] = result_data['fixed_code']
                file_fixes = []

                for fix in result_data['fixes_applied']:
                    if isinstance(fix, dict):
                        fix_spec = create_fix_spec(
                            agent=agent_name,
                            description=fix.get('description', str(fix)),
                            severity=fix.get('severity', default_sev),
                            before=fix.get('before'),
                            after=fix.get('after'),
                            line=fix.get('line'),
                            category=category
                        )
                    else:
                        fix_spec = create_fix_spec(
                            agent=agent_name, description=str(fix),
                            severity=default_sev
                        )
                    file_fixes.append(fix_spec)
                    step_fixes.append(fix_spec)

                # Emit file_updated event
                yield ev.file_updated(
                    file_path=file_path,
                    content=generated_files[file_path],
                    fixes=file_fixes,
                    fix_count=len(file_fixes)
                ).to_sse()

                all_fixes.append({
                    'agent': agent_name,
                    'file': file_path,
                    'fixes': result_data['fixes_applied']
                })

        step_duration = round(time.time() - step_start, 2)
        workflow_steps[ws_idx]["status"] = "complete"
        workflow_steps[ws_idx]["duration"] = step_duration
        yield ev.step_finished(step_id).to_sse()
        yield ev.workflow_update(workflow_steps).to_sse()

        yield ev.agent_result(
            agent_name=agent_name, icon=icon,
            data={"files_checked": len(code_files)},
            fixes=step_fixes,
            stats={"fixesApplied": len(step_fixes), "duration": step_duration}
        ).to_sse()

    # ===== FINAL =====
    total_duration = time.time() - start_time
    total_fix_count = sum(len(f.get('fixes', [])) for f in all_fixes)

    # Build project_files array for frontend
    project_files = []
    for file_info in project_plan.get("files", []):
        path = file_info["path"]
        content = generated_files.get(path, "")
        original = original_files.get(path)
        was_fixed = original is not None and original != content
        project_files.append({
            "path": path,
            "content": content,
            "original_content": original if was_fixed else None,
            "language": file_info.get("language", "text"),
            "purpose": file_info.get("purpose", ""),
            "lines": len(content.splitlines()),
            "was_fixed": was_fixed
        })

    yield ev.state_snapshot(snapshot={
        "mode": "multi",
        "project_name": project_plan.get("project_name", "project"),
        "project_files": project_files,
        "prompt": original_prompt,
        "all_fixes": all_fixes,
        "total_fixes": total_fix_count,
        "workflow": workflow_steps,
        "stats": {
            "totalDuration": round(total_duration, 2),
            "totalLines": sum(f["lines"] for f in project_files),
            "totalFiles": len(project_files),
            "totalFixes": total_fix_count
        },
        "phase": "complete"
    }).to_sse()

    yield ev.run_finished(result={
        "mode": "multi",
        "project_name": project_plan.get("project_name", "project"),
        "project_files": project_files,
        "prompt": original_prompt,
        "all_fixes": all_fixes,
        "total_fixes": total_fix_count,
        "workflow": workflow_steps,
        "stats": {
            "totalDuration": round(total_duration, 2),
            "totalLines": sum(f["lines"] for f in project_files),
            "totalFiles": len(project_files),
            "totalFixes": total_fix_count
        }
    }).to_sse()


def _strip_fences(text):
    """Remove markdown code fences from LLM output."""
    stripped = text.strip()
    if stripped.startswith("```"):
        lines = stripped.split("\n")
        lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        return "\n".join(lines)
    return stripped


@app.post("/api/edit")
async def edit_code(request: EditRequest):
    """Edit existing code and re-run agents"""
    if not request.original_code:
        raise HTTPException(status_code=400, detail="Original code is required")
    
    updated_code = request.original_code
    for update in request.updates:
        old = update.get('old', '')
        new = update.get('new', '')
        if old:
            updated_code = updated_code.replace(old, new)
    
    orchestrator = Orchestrator()
    result = orchestrator.run_agents_on_code(updated_code)
    
    return {"updated_code": updated_code, **result}


@app.post("/api/regenerate")
async def regenerate_with_edit(request: RegenerateRequest):
    """Regenerate code with edited prompt"""
    if not request.edit_instructions:
        raise HTTPException(status_code=400, detail="Edit instructions required")
    
    new_prompt = f"""Original request: {request.original_prompt}

Current code:
```
{request.current_code}
```

Please modify the code based on these instructions: {request.edit_instructions}

Only make the requested changes, keep the rest of the code intact."""
    
    orchestrator = Orchestrator(request.api_key)
    result = orchestrator.run_workflow(new_prompt)
    
    return result


@app.post("/api/regenerate/stream")
async def regenerate_stream(request: RegenerateRequest):
    """Streaming regeneration with edited prompt"""
    new_prompt = f"""Original request: {request.original_prompt}

Current code:
```
{request.current_code}
```

Modify based on: {request.edit_instructions}
Only make requested changes."""
    
    orchestrator = Orchestrator(request.api_key)
    
    async def generate():
        full_code = ""
        yield f"data: {json.dumps({'type': 'start', 'agent': 'Code Generator'})}\n\n"
        
        for chunk in orchestrator.generate_code_stream(new_prompt):
            full_code += chunk
            yield f"data: {json.dumps({'type': 'chunk', 'content': chunk})}\n\n"
        
        yield f"data: {json.dumps({'type': 'agent_complete', 'agent': 'Code Generator'})}\n\n"
        
        yield f"data: {json.dumps({'type': 'start', 'agent': 'Validator'})}\n\n"
        validation = orchestrator.validate_code(full_code)
        yield f"data: {json.dumps({'type': 'result', 'agent': 'Validator', 'data': validation})}\n\n"
        
        yield f"data: {json.dumps({'type': 'start', 'agent': 'Testing'})}\n\n"
        tests = orchestrator.test_code(full_code)
        yield f"data: {json.dumps({'type': 'result', 'agent': 'Testing', 'data': tests})}\n\n"
        
        yield f"data: {json.dumps({'type': 'start', 'agent': 'Security'})}\n\n"
        security = orchestrator.secure_code(full_code)
        yield f"data: {json.dumps({'type': 'result', 'agent': 'Security', 'data': security})}\n\n"
        
        yield f"data: {json.dumps({'type': 'complete', 'code': full_code, 'prompt': request.edit_instructions})}\n\n"
    
    return StreamingResponse(generate(), media_type="text/event-stream")


# ============== Session Management (MongoDB) ==============

@app.post("/api/sessions", response_model=SessionResponse)
async def create_session(user: dict = Depends(get_current_user)):
    """Create a new chat session (requires authentication)"""
    session = await SessionDB.create_session(user_id=user["_id"])
    return {"session_id": session["_id"], "created_at": session["created_at"].isoformat()}


@app.get("/api/sessions/{session_id}")
async def get_session(session_id: str, user: dict = Depends(get_current_user)):
    """Get a specific chat session with messages"""
    session = await SessionDB.get_session(session_id)
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Check ownership
    if session["user_id"] != user["_id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    messages = await MessageDB.get_session_messages(session_id)
    
    return {
        "session_id": session["_id"],
        "title": session.get("title", "New Chat"),
        "created_at": session["created_at"].isoformat(),
        "messages": [{
            "id": msg["_id"],
            "role": msg["role"],
            "content": msg["content"],
            "code_output": msg.get("code_output"),
            "workflow_data": msg.get("workflow_data"),
            "created_at": msg["created_at"].isoformat()
        } for msg in messages]
    }


@app.get("/api/sessions")
async def list_sessions(user: dict = Depends(get_current_user)):
    """List user's chat sessions"""
    sessions = await SessionDB.get_user_sessions(user["_id"])
    return [{
        "session_id": s["_id"],
        "title": s.get("title", "New Chat"),
        "created_at": s["created_at"].isoformat(),
        "updated_at": s["updated_at"].isoformat(),
        "message_count": s.get("message_count", 0)
    } for s in sessions]


@app.delete("/api/sessions/{session_id}")
async def delete_session(session_id: str, user: dict = Depends(get_current_user)):
    """Delete a chat session"""
    session = await SessionDB.get_session(session_id)
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session["user_id"] != user["_id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    await SessionDB.delete_session(session_id)
    return {"message": "Session deleted"}


class AddMessageRequest(BaseModel):
    role: str
    content: str
    code_output: Optional[str] = None
    workflow_data: Optional[dict] = None


@app.post("/api/sessions/{session_id}/messages")
async def add_message_to_session(
    session_id: str, 
    request: AddMessageRequest,
    user: dict = Depends(get_current_user)
):
    """Add a message to a session and auto-generate title if first user message"""
    session = await SessionDB.get_session(session_id)
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session["user_id"] != user["_id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Add the message
    message = await MessageDB.add_message(
        session_id=session_id,
        role=request.role,
        content=request.content,
        code_output=request.code_output,
        workflow_data=request.workflow_data
    )
    
    # Auto-generate title on first user message if title is still "New Chat"
    if request.role == "user" and session.get("title") == "New Chat":
        # Get message count
        messages = await MessageDB.get_session_messages(session_id)
        user_messages = [m for m in messages if m["role"] == "user"]
        
        if len(user_messages) == 1:  # First user message
            title = await SessionDB.generate_title_from_chat(request.content)
            await SessionDB.update_session_title(session_id, title)
            return {
                "message_id": message["_id"],
                "new_title": title
            }
    
    return {"message_id": message["_id"]}


@app.patch("/api/sessions/{session_id}/title")
async def update_session_title_endpoint(
    session_id: str,
    title: str,
    user: dict = Depends(get_current_user)
):
    """Manually update session title"""
    session = await SessionDB.get_session(session_id)
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session["user_id"] != user["_id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    await SessionDB.update_session_title(session_id, title)
    return {"message": "Title updated", "title": title}


class BulkDeleteRequest(BaseModel):
    session_ids: List[str]


@app.post("/api/sessions/bulk-delete")
async def bulk_delete_sessions(
    request: BulkDeleteRequest,
    user: dict = Depends(get_current_user)
):
    """Delete multiple sessions at once"""
    deleted_count = 0
    
    for session_id in request.session_ids:
        try:
            session = await SessionDB.get_session(session_id)
            if session and session["user_id"] == user["_id"]:
                await SessionDB.delete_session(session_id)
                deleted_count += 1
        except Exception as e:
            print(f"Error deleting session {session_id}: {e}")
            continue
    
    return {"message": f"Deleted {deleted_count} sessions", "deleted_count": deleted_count}


@app.post("/api/sessions/cleanup-empty")
async def cleanup_empty_sessions(user: dict = Depends(get_current_user)):
    """Delete all sessions with 0 messages"""
    sessions = await SessionDB.get_user_sessions(user["_id"], limit=100)
    deleted_count = 0
    
    for session in sessions:
        if session.get("message_count", 0) == 0:
            try:
                await SessionDB.delete_session(session["_id"])
                deleted_count += 1
            except Exception as e:
                print(f"Error cleaning up session {session['_id']}: {e}")
    
    return {"message": f"Cleaned up {deleted_count} empty sessions", "deleted_count": deleted_count}


# Run with: python main.py
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=settings.PORT, reload=True)
