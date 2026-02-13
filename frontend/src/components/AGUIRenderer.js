// AG-UI Renderer - Processes AG-UI Protocol events into React components
// Implements the Agent-User Interaction Protocol (https://docs.ag-ui.com)
//
// Event Types handled:
//   Lifecycle: RUN_STARTED, RUN_FINISHED, RUN_ERROR, STEP_STARTED, STEP_FINISHED
//   Text:      TEXT_MESSAGE_START, TEXT_MESSAGE_CONTENT, TEXT_MESSAGE_END
//   Tool:      TOOL_CALL_START, TOOL_CALL_ARGS, TOOL_CALL_END, TOOL_CALL_RESULT
//   State:     STATE_SNAPSHOT, STATE_DELTA
//   Special:   CUSTOM (workflow_update, agent_activity, code_update, agent_result)

import React from 'react';
import {
  Card,
  Grid,
  StatCard,
  ProgressBar,
  Badge,
  CodeBlock,
  CodeDiff,
  AgentStatusCard,
  FixCard,
  VulnerabilityCard,
  WorkflowTimeline,
  Timeline,
  Expandable,
  Tabs,
  DataTable,
  Alert
} from './GenUIComponents';
import { EventType, parseSSEEvent, applyJsonPatch } from '../agui/client';

// ==================== COMPONENT TYPE REGISTRY ====================

const componentRegistry = {
  card: Card,
  grid: Grid,
  stat: StatCard,
  progress: ProgressBar,
  badge: Badge,
  code_block: CodeBlock,
  code_diff: CodeDiff,
  agent_status: AgentStatusCard,
  fix_card: FixCard,
  vulnerability_card: VulnerabilityCard,
  timeline: Timeline,
  workflow_graph: WorkflowTimeline,
  expandable: Expandable,
  tabs: Tabs,
  table: DataTable,
  alert: Alert
};

// ==================== MAIN RENDERER ====================

/**
 * Renders a UI component from AG-UI spec
 */
export const renderUIComponent = (spec, onAction) => {
  if (!spec || !spec.type) return null;
  
  const Component = componentRegistry[spec.type];
  if (!Component) {
    console.warn(`Unknown component type: ${spec.type}`);
    return null;
  }
  
  const props = {
    ...spec.props,
    key: spec.id,
    className: spec.style?.className,
    variant: spec.style?.variant
  };
  
  if (spec.children && Array.isArray(spec.children)) {
    props.children = spec.children.map(child => renderUIComponent(child, onAction));
  }
  
  if (spec.actions && onAction) {
    spec.actions.forEach(action => {
      const handlerName = `on${action.name.charAt(0).toUpperCase() + action.name.slice(1)}`;
      props[handlerName] = () => onAction(action.name, action.payload);
    });
  }
  
  return <Component {...props} />;
};

export const renderUIComponents = (specs, onAction) => {
  if (!specs || !Array.isArray(specs)) return null;
  return specs.map(spec => renderUIComponent(spec, onAction));
};

// ==================== AG-UI EVENT PROCESSOR ====================

/**
 * Process a standardized AG-UI event and return render-friendly data.
 * Handles all 16 AG-UI event types + CUSTOM sub-types.
 */
export const processAGUIEvent = (event) => {
  const { type } = event;

  switch (type) {
    // --- Lifecycle Events ---
    case EventType.RUN_STARTED:
      return {
        renderType: 'run_started',
        threadId: event.threadId,
        runId: event.runId,
        input: event.input
      };

    case EventType.RUN_FINISHED:
      return {
        renderType: 'run_finished',
        result: event.result,
        code: event.result?.code,
        original_code: event.result?.original_code,
        all_fixes: event.result?.all_fixes,
        total_fixes: event.result?.total_fixes,
        code_was_fixed: event.result?.code_was_fixed,
        stats: event.result?.stats,
        validation: event.result?.validation,
        tests: event.result?.tests,
        security: event.result?.security,
        workflow: event.result?.workflow
      };

    case EventType.RUN_ERROR:
      return {
        renderType: 'error',
        message: event.message,
        code: event.code
      };

    case EventType.STEP_STARTED:
      return {
        renderType: 'step_started',
        stepName: event.stepName
      };

    case EventType.STEP_FINISHED:
      return {
        renderType: 'step_finished',
        stepName: event.stepName
      };

    // --- Text Message Events ---
    case EventType.TEXT_MESSAGE_START:
      return {
        renderType: 'text_message_start',
        messageId: event.messageId,
        role: event.role
      };

    case EventType.TEXT_MESSAGE_CONTENT:
      return {
        renderType: 'text_message_content',
        messageId: event.messageId,
        delta: event.delta
      };

    case EventType.TEXT_MESSAGE_END:
      return {
        renderType: 'text_message_end',
        messageId: event.messageId
      };

    // --- Tool Call Events ---
    case EventType.TOOL_CALL_START:
      return {
        renderType: 'tool_call_start',
        toolCallId: event.toolCallId,
        toolCallName: event.toolCallName,
        parentMessageId: event.parentMessageId
      };

    case EventType.TOOL_CALL_ARGS:
      return {
        renderType: 'tool_call_args',
        toolCallId: event.toolCallId,
        delta: event.delta
      };

    case EventType.TOOL_CALL_END:
      return {
        renderType: 'tool_call_end',
        toolCallId: event.toolCallId
      };

    case EventType.TOOL_CALL_RESULT:
      return {
        renderType: 'tool_call_result',
        toolCallId: event.toolCallId,
        content: event.content,
        messageId: event.messageId
      };

    // --- State Management Events ---
    case EventType.STATE_SNAPSHOT:
      return {
        renderType: 'state_snapshot',
        snapshot: event.snapshot
      };

    case EventType.STATE_DELTA:
      return {
        renderType: 'state_delta',
        delta: event.delta
      };

    // --- CUSTOM Events (domain-specific) ---
    case EventType.CUSTOM:
      return processCustomEvent(event);

    default:
      return { renderType: 'unknown', event };
  }
};

/**
 * Process CUSTOM AG-UI events by sub-name.
 * Maps domain-specific events (workflow_update, agent_activity, etc.)
 */
const processCustomEvent = (event) => {
  const { name, value } = event;

  switch (name) {
    case 'workflow_update':
      return {
        renderType: 'workflow',
        steps: value?.steps || []
      };

    case 'agent_activity':
      return {
        renderType: 'agent_activity',
        agentName: value?.agentName,
        icon: value?.icon,
        phase: value?.phase,
        message: value?.message,
        progress: value?.progress,
        stats: value?.stats
      };

    case 'code_update':
      return {
        renderType: 'code_update',
        source: value?.source,
        code: value?.code,
        fixCount: value?.fixCount,
        fixes: value?.fixes
      };

    case 'agent_result':
      return {
        renderType: 'agent_result',
        agentName: value?.agentName,
        icon: value?.icon,
        data: value?.data,
        fixes: value?.fixes,
        stats: value?.stats
      };

    default:
      return {
        renderType: 'custom',
        name,
        value
      };
  }
};

// ==================== SPECIALIZED RENDERERS ====================

/**
 * Render an agent status based on processed event
 */
export const renderAgentStatus = (processed) => {
  const { agentName, message, progress, phase, fixes, stats, duration, icon } = processed;
  
  return (
    <AgentStatusCard
      key={agentName}
      agentName={agentName}
      icon={icon || getAgentIcon(agentName)}
      phase={phase || (processed.renderType === 'agent_result' ? 'complete' : 'processing')}
      message={message}
      progress={progress}
      fixes={fixes}
      stats={stats}
      duration={duration}
    />
  );
};

/**
 * Render fixes from an agent
 */
export const renderFixes = (fixes, agentName) => {
  if (!fixes || fixes.length === 0) return null;
  
  return (
    <div className="genui-fixes-container">
      <h4 className="genui-fixes-title">
        🔧 {fixes.length} Fix{fixes.length !== 1 ? 'es' : ''} by {agentName}
      </h4>
      {fixes.map((fix, index) => (
        <FixCard
          key={`${agentName}-fix-${index}`}
          agent={fix.agent || agentName}
          description={fix.description || (typeof fix === 'string' ? fix : JSON.stringify(fix))}
          severity={fix.severity || 'medium'}
          before={fix.before}
          after={fix.after}
          line={fix.line}
          category={fix.category}
          applied={true}
        />
      ))}
    </div>
  );
};

/**
 * Render workflow timeline
 */
export const renderWorkflow = (steps) => {
  if (!steps || steps.length === 0) return null;
  return <WorkflowTimeline steps={steps} orientation="horizontal" />;
};

/**
 * Render completion summary
 */
export const renderCompletionSummary = (data) => {
  const { stats, total_fixes } = data;
  
  return (
    <div className="genui-completion-summary">
      <Alert 
        severity="success" 
        title="Generation Complete"
        message={`Generated successfully with ${total_fixes || 0} fixes applied`}
        dismissible={false}
      />
      <Grid columns={4}>
        <StatCard label="Lines" value={stats?.totalLines || '-'} icon="📝" />
        <StatCard label="Fixes" value={stats?.totalFixes || 0} icon="🔧" />
        <StatCard label="Duration" value={`${stats?.totalDuration || '-'}s`} icon="⏱️" />
        <StatCard label="Agents" value={4} icon="🤖" />
      </Grid>
    </div>
  );
};

// ==================== UTILITY FUNCTIONS ====================

function getAgentIcon(agentId) {
  const icons = {
    code_generator: '⚡',
    'code generator': '⚡',
    validator: '✓',
    testing: '🧪',
    'testing agent': '🧪',
    security: '🛡️',
    'security agent': '🛡️'
  };
  return icons[agentId?.toLowerCase()] || '🤖';
}

/**
 * Parse SSE data line (delegates to AG-UI client)
 */
export const parseSSEData = parseSSEEvent;

/**
 * Create a state manager for tracking agent states during streaming
 */
export const createAgentStateManager = () => {
  let agents = {};
  let workflow = [];
  let code = '';
  let originalCode = '';
  let allFixes = [];
  let state = {};
  
  return {
    updateAgent: (agentId, data) => {
      agents[agentId] = { ...agents[agentId], ...data };
      return { ...agents };
    },
    getAgents: () => ({ ...agents }),
    updateWorkflow: (steps) => { workflow = steps; return [...workflow]; },
    getWorkflow: () => [...workflow],
    updateCode: (newCode, isOriginal = false) => {
      if (isOriginal) originalCode = newCode;
      code = newCode;
      return code;
    },
    getCode: () => code,
    getOriginalCode: () => originalCode,
    addFixes: (agentName, fixes) => {
      allFixes.push({ agent: agentName, fixes });
      return [...allFixes];
    },
    getAllFixes: () => [...allFixes],
    updateState: (snapshot) => { state = snapshot; return { ...state }; },
    applyStateDelta: (delta) => {
      state = applyJsonPatch(state, delta);
      return { ...state };
    },
    getState: () => ({ ...state }),
    reset: () => {
      agents = {};
      workflow = [];
      code = '';
      originalCode = '';
      allFixes = [];
      state = {};
    }
  };
};

// ==================== REACT HOOK ====================

/**
 * Hook for managing AG-UI protocol state during streaming.
 * Handles all standard AG-UI event types.
 */
export const useAGUIState = () => {
  const [agents, setAgents] = React.useState({});
  const [workflow, setWorkflow] = React.useState([]);
  const [code, setCode] = React.useState('');
  const [originalCode, setOriginalCode] = React.useState('');
  const [fixes, setFixes] = React.useState([]);
  const [isComplete, setIsComplete] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [runState, setRunState] = React.useState({});
  const [activeStep, setActiveStep] = React.useState(null);
  const [toolCalls, setToolCalls] = React.useState({});
  
  const processEvent = React.useCallback((event) => {
    const processed = processAGUIEvent(event);
    
    switch (processed.renderType) {
      // Lifecycle
      case 'run_started':
        setRunState({ threadId: processed.threadId, runId: processed.runId });
        break;

      case 'run_finished':
        setIsComplete(true);
        if (processed.original_code) {
          setOriginalCode(processed.original_code);
        }
        break;

      case 'error':
        setError(processed);
        break;

      case 'step_started':
        setActiveStep(processed.stepName);
        break;

      case 'step_finished':
        setActiveStep(null);
        break;

      // Text streaming
      case 'text_message_content':
        setCode(prev => prev + processed.delta);
        break;

      // State management
      case 'state_snapshot':
        setRunState(prev => ({ ...prev, ...processed.snapshot }));
        if (processed.snapshot?.code) {
          setCode(processed.snapshot.code);
        }
        if (processed.snapshot?.workflow) {
          setWorkflow(processed.snapshot.workflow);
        }
        break;

      case 'state_delta':
        setRunState(prev => applyJsonPatch(prev, processed.delta));
        break;

      // Tool calls (fixes)
      case 'tool_call_start':
        setToolCalls(prev => ({
          ...prev,
          [processed.toolCallId]: {
            name: processed.toolCallName,
            args: '',
            parentMessageId: processed.parentMessageId
          }
        }));
        break;

      case 'tool_call_args':
        setToolCalls(prev => ({
          ...prev,
          [processed.toolCallId]: {
            ...prev[processed.toolCallId],
            args: (prev[processed.toolCallId]?.args || '') + processed.delta
          }
        }));
        break;

      case 'tool_call_result':
        setToolCalls(prev => ({
          ...prev,
          [processed.toolCallId]: {
            ...prev[processed.toolCallId],
            result: processed.content
          }
        }));
        break;

      // Domain-specific (CUSTOM events)
      case 'agent_activity':
        setAgents(prev => ({
          ...prev,
          [processed.agentName]: {
            ...prev[processed.agentName],
            ...processed
          }
        }));
        break;

      case 'agent_result':
        setAgents(prev => ({
          ...prev,
          [processed.agentName]: {
            ...prev[processed.agentName],
            ...processed,
            phase: 'complete'
          }
        }));
        break;

      case 'code_update':
        if (processed.code) setCode(processed.code);
        if (processed.fixes) {
          setFixes(prev => [...prev, { agent: processed.source, fixes: processed.fixes }]);
        }
        break;

      case 'workflow':
        setWorkflow(processed.steps);
        break;

      default:
        break;
    }
    
    return processed;
  }, []);
  
  const reset = React.useCallback(() => {
    setAgents({});
    setWorkflow([]);
    setCode('');
    setOriginalCode('');
    setFixes([]);
    setIsComplete(false);
    setError(null);
    setRunState({});
    setActiveStep(null);
    setToolCalls({});
  }, []);
  
  return {
    agents,
    workflow,
    code,
    originalCode,
    fixes,
    isComplete,
    error,
    runState,
    activeStep,
    toolCalls,
    processEvent,
    reset
  };
};

// ==================== EXPORTS ====================

const AGUIRenderer = {
  renderUIComponent,
  renderUIComponents,
  processAGUIEvent,
  renderAgentStatus,
  renderFixes,
  renderWorkflow,
  renderCompletionSummary,
  parseSSEData,
  createAgentStateManager,
  useAGUIState
};

export default AGUIRenderer;
