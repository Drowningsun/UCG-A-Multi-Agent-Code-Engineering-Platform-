// Generative UI Chat Interface V2 - Clean Split-Panel Design
// Professional-grade, spacious layout with AG-UI Protocol

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import UserMenu from '../components/UserMenu';
import UsageLimitModal from '../components/UsageLimitModal';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CodeBlock,
  CodeDiff,
  FixCard,
  Expandable,
  Tabs,
  Badge
} from '../components/GenUIComponents';
import { useAGUIState, parseSSEData } from '../components/AGUIRenderer';
import { EventType } from '../agui/client';
import FileTree from '../components/FileTree';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import '../components/GenUIComponents.css';
import '../components/FileTree.css';
import './GenUIChatPageV2.css';

const API_BASE = 'http://localhost:5000/api';

const GenUIChatPageV2 = () => {
  const { sessionId: urlSessionId } = useParams();
  const navigate = useNavigate();
  const { authAxios, token, isAuthenticated, hasReachedGuestLimit, incrementGuestUsage } = useAuth();

  // Usage limit modal state
  const [showUsageLimitModal, setShowUsageLimitModal] = useState(false);

  // Session state
  const [sessionId, setSessionId] = useState(urlSessionId || null);
  const [sessionTitle, setSessionTitle] = useState('New Chat');
  const [messages, setMessages] = useState([]);

  // Input state
  const [prompt, setPrompt] = useState('');

  // Streaming & result state
  const [loading, setLoading] = useState(false);
  const [streamingCode, setStreamingCode] = useState('');
  const [streamingStats, setStreamingStats] = useState({ lines: 0, chars: 0 });

  // AG-UI State
  const { processEvent, reset: resetAGUI } = useAGUIState();

  // Result state
  const [result, setResult] = useState(null);
  const [showOriginal, setShowOriginal] = useState(false);

  // Edit message state
  const [editingMessageIndex, setEditingMessageIndex] = useState(null);
  const [editingContent, setEditingContent] = useState('');
  
  // Selected message index for viewing previous results
  const [selectedMessageIndex, setSelectedMessageIndex] = useState(null);

  // Panel state
  const [rightPanelTab, setRightPanelTab] = useState('code'); // 'code', 'agents', 'fixes'
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [panelWidth, setPanelWidth] = useState(500);
  const [isResizing, setIsResizing] = useState(false);

  // Active agent for display
  const [activeAgent, setActiveAgent] = useState(null);
  const [agentMessages, setAgentMessages] = useState([]);

  // Completion celebration
  const [showCompletion, setShowCompletion] = useState(false);

  // Multi-file state
  const [projectMode, setProjectMode] = useState('single'); // 'single' | 'multi'
  const [projectPlan, setProjectPlan] = useState(null);
  const [projectFiles, setProjectFiles] = useState(new Map()); // path -> {content, language, purpose, lines, status}
  const [activeFile, setActiveFile] = useState(null); // currently selected file path
  const [openTabs, setOpenTabs] = useState([]); // array of open file paths
  const [streamingFile, setStreamingFile] = useState(null); // file currently being streamed
  const [completedFiles, setCompletedFiles] = useState(new Set());

  // Refs
  const messagesEndRef = useRef(null);
  const sessionCreatedRef = useRef(false);
  const resizeRef = useRef(null);

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Panel resize handlers - using refs to avoid stale closures
  const panelWidthRef = useRef(panelWidth);

  const startResize = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
    resizeRef.current = e.clientX;
    panelWidthRef.current = panelWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [panelWidth]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e) => {
      const diff = resizeRef.current - e.clientX;
      const newWidth = Math.min(Math.max(panelWidthRef.current + diff, 350), 900);
      panelWidthRef.current = newWidth;
      resizeRef.current = e.clientX;
      setPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Handle URL session ID changes
  useEffect(() => {
    if (urlSessionId && isAuthenticated) {
      // Only load session from URL if authenticated
      setSessionId(urlSessionId);
      sessionCreatedRef.current = true;
    } else if (!sessionCreatedRef.current) {
      sessionCreatedRef.current = true;
      if (isAuthenticated) {
        createSession();
      } else {
        // Guest mode - just set up local state
        setSessionTitle('Guest Session');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSessionId, isAuthenticated]);

  // Load session data
  useEffect(() => {
    if (sessionId && token) {
      loadSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, token]);

  // Helper to build a result object from a message's stored data
  const buildResultFromMessage = (msg) => {
    const workflowData = msg.workflow_data || {};
    const restoredStats = workflowData.stats || {};
    const mode = workflowData.mode || 'single';

    if (mode === 'multi') {
      return {
        mode: 'multi',
        project_name: workflowData.project_name || 'project',
        project_files: workflowData.project_files || [],
        all_fixes: workflowData.all_fixes || [],
        total_fixes: workflowData.total_fixes || 0,
        stats: {
          totalDuration: restoredStats.totalDuration || null,
          totalLines: restoredStats.totalLines || 0,
          totalFiles: restoredStats.totalFiles || 0,
          totalFixes: restoredStats.totalFixes || 0
        }
      };
    }

    return {
      mode: 'single',
      code: msg.code_output,
      original_code: workflowData.original_code,
      all_fixes: workflowData.all_fixes || [],
      code_was_fixed: workflowData.code_was_fixed,
      total_fixes: workflowData.total_fixes || 0,
      validation: workflowData.validation,
      tests: workflowData.tests,
      security: workflowData.security,
      stats: {
        totalDuration: restoredStats.totalDuration || restoredStats.total_duration || null,
        totalLines: restoredStats.totalLines || restoredStats.total_lines || 0,
        totalFixes: restoredStats.totalFixes || restoredStats.total_fixes || 0
      }
    };
  };

  // Handle clicking an assistant message to view its result in the right panel
  const selectMessage = useCallback((index) => {
    const msg = messages[index];
    if (!msg || msg.role !== 'assistant' || !msg.hasResult) return;

    setSelectedMessageIndex(index);
    const builtResult = buildResultFromMessage(msg);
    setResult(builtResult);
    setShowOriginal(false);
    setShowRightPanel(true);
    setRightPanelTab('code');

    // Restore mode-specific state
    if (builtResult.mode === 'multi') {
      setProjectMode('multi');
      const restoredFiles = new Map();
      const tabs = [];
      for (const f of (builtResult.project_files || [])) {
        restoredFiles.set(f.path, {
          content: f.content,
          language: f.language || 'text',
          purpose: f.purpose || '',
          lines: f.lines || f.content?.split('\n').length || 0,
          status: 'complete'
        });
        tabs.push(f.path);
      }
      setProjectFiles(restoredFiles);
      setOpenTabs(tabs);
      setActiveFile(tabs[0] || null);
      setCompletedFiles(new Set(tabs));
      setStreamingFile(null);
    } else {
      setProjectMode('single');
      setProjectFiles(new Map());
      setOpenTabs([]);
      setActiveFile(null);
    }

    // Restore agent messages for this specific message
    if (msg.workflow_data?.agent_messages) {
      setAgentMessages(msg.workflow_data.agent_messages);
    }
  }, [messages]);

  const loadSession = async () => {
    if (!sessionId || !token) return;
    try {
      const response = await authAxios.get(`/sessions/${sessionId}`);
      setSessionTitle(response.data.title || 'New Chat');
      if (response.data.messages?.length > 0) {
        const loadedMessages = response.data.messages.map(msg => ({
          role: msg.role,
          content: msg.content,
          code_output: msg.code_output,
          workflow_data: msg.workflow_data,
          hasResult: !!msg.code_output
        }));
        setMessages(loadedMessages);

        // Find last assistant message with code and select it
        const lastAssistantIndex = loadedMessages.map((m, i) => ({ ...m, i })).filter(m => m.hasResult).pop()?.i;
        if (lastAssistantIndex !== undefined) {
          const lastMsg = loadedMessages[lastAssistantIndex];
          setSelectedMessageIndex(lastAssistantIndex);
          setResult(buildResultFromMessage(lastMsg));

          // Restore agent messages if available
          if (lastMsg.workflow_data?.agent_messages) {
            setAgentMessages(lastMsg.workflow_data.agent_messages);
          }
        }
      }
    } catch (error) {
      console.error('Error loading session:', error);
    }
  };

  const createSession = async () => {
    // Only create sessions for authenticated users
    if (!isAuthenticated) {
      // Guest mode - just reset local state
      setSessionId(null);
      setSessionTitle('Guest Session');
      setMessages([]);
      setPrompt('');
      setResult(null);
      setStreamingCode('');
      resetAGUI();
      sessionCreatedRef.current = true;
      navigate('/chat');
      return;
    }

    try {
      const response = await authAxios.post('/sessions');
      const newSessionId = response.data.session_id;
      setSessionId(newSessionId);
      setSessionTitle('New Chat');
      setMessages([]);
      setPrompt('');
      setResult(null);
      setStreamingCode('');
      resetAGUI();
      sessionCreatedRef.current = true;
      navigate(`/chat/${newSessionId}`);
    } catch (error) {
      console.error('Error creating session:', error);
    }
  };

  // Main submit handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;

    // Check guest usage limit
    if (!isAuthenticated && hasReachedGuestLimit()) {
      setShowUsageLimitModal(true);
      return;
    }

    const userMessage = { role: 'user', content: prompt };
    setMessages(prev => [...prev, userMessage]);

    if (sessionId && token) {
      try {
        const saveResponse = await authAxios.post(`/sessions/${sessionId}/messages`, {
          role: 'user',
          content: prompt
        });
        if (saveResponse.data.new_title) {
          setSessionTitle(saveResponse.data.new_title);
        }
      } catch (error) {
        console.error('Error saving user message:', error);
      }
    }

    setLoading(true);
    setStreamingCode('');
    setStreamingStats({ lines: 0, chars: 0 });
    setResult(null);
    setShowOriginal(false);
    setAgentMessages([]);
    setShowRightPanel(true);
    setRightPanelTab('code');
    resetAGUI();

    // Reset multi-file state
    setProjectMode('single');
    setProjectPlan(null);
    setProjectFiles(new Map());
    setActiveFile(null);
    setOpenTabs([]);
    setStreamingFile(null);
    setCompletedFiles(new Set());

    try {
      // Include context_code if we have previously generated code
      // Only send context_code for single-file follow-ups, not new multi-file requests
      const previousCode = (result?.mode === 'single' && result?.code) ? result.code : null;
      const requestBody = {
        prompt,
        api_key: localStorage.getItem('groq_api_key') || null,
        context_code: previousCode
      };

      const response = await fetch(`${API_BASE}/generate/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullCode = '';
      let originalCode = ''; // Store the first generated code before any fixes
      let agentResults = {};
      let finalAllFixes = [];
      let localAgentMessages = []; // Track agent messages locally for saving
      const startTime = Date.now(); // Track start time for duration calculation
      let currentStreamingFile = null; // Track which file is being streamed (multi-file)
      let multiFileContents = {}; // {path: content} for multi-file mode
      let localProjectPlan = null; // Store plan locally for saving

      // Extracted event handler to avoid no-loop-func warning
      const handleSSEEvent = (data) => {
        processEvent(data);

        // ==== AG-UI Protocol Event Handler ====
        switch (data.type) {
          case EventType.RUN_STARTED:
            break;

          case EventType.STEP_STARTED:
            setActiveAgent(data.stepName);
            break;

          case EventType.STEP_FINISHED:
            break;

          case EventType.TEXT_MESSAGE_START:
            break;

          case EventType.TEXT_MESSAGE_CONTENT:
            if (currentStreamingFile) {
              const prevContent = multiFileContents[currentStreamingFile] || '';
              multiFileContents[currentStreamingFile] = prevContent + (data.delta || '');
              const fileKey = currentStreamingFile;
              const newContent = multiFileContents[fileKey];
              setProjectFiles(prev => {
                const next = new Map(prev);
                const existing = next.get(fileKey) || {};
                next.set(fileKey, {
                  ...existing,
                  content: newContent,
                  lines: newContent.split('\n').length
                });
                return next;
              });
              setStreamingCode(newContent);
              setStreamingStats({
                lines: newContent.split('\n').length,
                chars: newContent.length
              });
            } else {
              fullCode += data.delta || '';
              setStreamingCode(fullCode);
              setStreamingStats({
                lines: fullCode.split('\n').length,
                chars: fullCode.length
              });
            }
            break;

          case EventType.TEXT_MESSAGE_END:
            break;

          case EventType.TOOL_CALL_START:
            break;

          case EventType.TOOL_CALL_ARGS:
            break;

          case EventType.TOOL_CALL_END:
            break;

          case EventType.TOOL_CALL_RESULT:
            break;

            case EventType.STATE_SNAPSHOT:
              // Full state snapshot — update based on mode
              if (data.snapshot?.mode === 'multi') {
                setProjectMode('multi');
              }
              if (data.snapshot?.code) {
                fullCode = data.snapshot.code;
                setStreamingCode(fullCode);
              }
              break;

            case EventType.STATE_DELTA:
              // Incremental state update (JSON Patch)
              break;

            case EventType.CUSTOM:
              // Domain-specific events via CUSTOM
              switch (data.name) {
                case 'project_plan': {
                  // Multi-file: project plan received
                  const plan = data.value?.plan || data.value;
                  localProjectPlan = plan;
                  setProjectMode('multi');
                  setProjectPlan(plan);

                  // Initialize file entries from plan
                  const initialFiles = new Map();
                  const initialTabs = [];
                  for (const f of (plan.files || [])) {
                    initialFiles.set(f.path, {
                      content: '',
                      language: f.language || 'text',
                      purpose: f.purpose || '',
                      lines: 0,
                      status: 'pending'
                    });
                    initialTabs.push(f.path);
                  }
                  setProjectFiles(initialFiles);
                  setOpenTabs(initialTabs);
                  if (initialTabs.length > 0) setActiveFile(initialTabs[0]);

                  const planMsg = {
                    agent: 'Project Planner',
                    message: `📋 Planned ${plan.files?.length || 0} files for "${plan.project_name || 'project'}"`,
                    type: 'result',
                    time: new Date().toLocaleTimeString()
                  };
                  localAgentMessages.push(planMsg);
                  setAgentMessages(prev => [...prev, planMsg]);
                  break;
                }

                case 'file_started': {
                  // Multi-file: file generation starting
                  const filePath = data.value?.path || data.value?.filePath;
                  currentStreamingFile = filePath;
                  multiFileContents[filePath] = '';
                  setStreamingFile(filePath);
                  setActiveFile(filePath);
                  setStreamingCode('');

                  // Update file status
                  setProjectFiles(prev => {
                    const next = new Map(prev);
                    const existing = next.get(filePath) || {};
                    next.set(filePath, {
                      ...existing,
                      language: data.value?.language || existing.language || 'text',
                      purpose: data.value?.purpose || existing.purpose || '',
                      status: 'streaming'
                    });
                    return next;
                  });
                  break;
                }

                case 'file_completed': {
                  // Multi-file: file generation complete
                  const filePath = data.value?.path || data.value?.filePath;
                  const content = data.value?.content || multiFileContents[filePath] || '';
                  multiFileContents[filePath] = content;
                  currentStreamingFile = null;
                  setStreamingFile(null);

                  setProjectFiles(prev => {
                    const next = new Map(prev);
                    const existing = next.get(filePath) || {};
                    next.set(filePath, {
                      ...existing,
                      content: content,
                      lines: data.value?.lines || content.split('\n').length,
                      language: data.value?.language || existing.language || 'text',
                      status: 'complete'
                    });
                    return next;
                  });
                  setCompletedFiles(prev => new Set([...prev, filePath]));
                  break;
                }

                case 'file_updated': {
                  // Multi-file: file updated by validation/testing/security agent
                  const filePath = data.value?.path || data.value?.filePath;
                  const content = data.value?.content || '';
                  if (filePath && content) {
                    multiFileContents[filePath] = content;
                    setProjectFiles(prev => {
                      const next = new Map(prev);
                      const existing = next.get(filePath) || {};
                      next.set(filePath, {
                        ...existing,
                        content: content,
                        lines: content.split('\n').length,
                        status: 'updated'
                      });
                      return next;
                    });
                  }
                  break;
                }

                case 'agent_activity': {
                  const agentName = data.value?.agentName || 'Agent';
                  setActiveAgent(agentName);
                  const activityMsg = {
                    agent: agentName,
                    message: data.value?.message || `${agentName} processing...`,
                    progress: data.value?.progress,
                    type: data.value?.phase === 'complete' ? 'result' : (data.value?.phase === 'starting' ? 'start' : 'progress'),
                    time: new Date().toLocaleTimeString()
                  };
                  localAgentMessages.push(activityMsg);
                  setAgentMessages(prev => [...prev, activityMsg]);
                  break;
                }

                case 'code_update': {
                  // Capture original code before first fix
                  if (!originalCode && fullCode) {
                    originalCode = fullCode;
                  }
                  fullCode = data.value?.code || fullCode;
                  setStreamingCode(fullCode);
                  if (data.value?.fixes) {
                    finalAllFixes.push({
                      agent: data.value?.source,
                      fixes: data.value.fixes
                    });
                  }
                  const codeUpdateMsg = {
                    agent: data.value?.source,
                    message: `Applied ${data.value?.fixCount || 0} fixes`,
                    fixes: data.value?.fixes,
                    type: 'code_update',
                    time: new Date().toLocaleTimeString()
                  };
                  localAgentMessages.push(codeUpdateMsg);
                  setAgentMessages(prev => [...prev, codeUpdateMsg]);
                  break;
                }

                case 'agent_result': {
                  const agentKey = data.value?.agentName?.toLowerCase() || 'agent';
                  agentResults[agentKey] = data.value?.data;

                  if (data.value?.fixes && data.value.fixes.length > 0) {
                    finalAllFixes.push({
                      agent: data.value?.agentName,
                      fixes: data.value.fixes
                    });
                  }

                  const resultMsg = {
                    agent: data.value?.agentName,
                    message: data.value?.stats?.fixesApplied
                      ? `Completed with ${data.value.stats.fixesApplied} fixes`
                      : `Completed`,
                    stats: data.value?.stats,
                    fixes: data.value?.fixes,
                    type: 'result',
                    time: new Date().toLocaleTimeString()
                  };
                  localAgentMessages.push(resultMsg);
                  setAgentMessages(prev => [...prev, resultMsg]);
                  break;
                }

                case 'workflow_update': {
                  // Workflow timeline update (handled by useAGUIState hook)
                  break;
                }

                default:
                  break;
              }
              break;

            case EventType.RUN_FINISHED: {
              // Run complete — extract final result from AG-UI result payload
              const res = data.result || {};
              const mode = res.mode || 'single';
              const mergedFixes = res.all_fixes?.length > 0 ? res.all_fixes : finalAllFixes;
              const duration = res.stats?.totalDuration || ((Date.now() - startTime) / 1000).toFixed(1);

              if (mode === 'multi') {
                // Multi-file result
                const finalResult = {
                  mode: 'multi',
                  project_name: res.project_name || localProjectPlan?.project_name || 'project',
                  project_files: res.project_files || [],
                  prompt: res.prompt,
                  all_fixes: mergedFixes,
                  total_fixes: res.total_fixes || mergedFixes.reduce((sum, f) => sum + (f.fixes?.length || 0), 0),
                  workflow: res.workflow,
                  stats: { ...res.stats, totalDuration: duration }
                };
                setResult(finalResult);

                // Update project files state from final data
                setProjectFiles(prev => {
                  const next = new Map(prev);
                  for (const pf of (res.project_files || [])) {
                    next.set(pf.path, {
                      content: pf.content,
                      language: pf.language || 'text',
                      purpose: pf.purpose || '',
                      lines: pf.lines || pf.content?.split('\n').length || 0,
                      original_content: pf.original_content,
                      was_fixed: pf.was_fixed,
                      status: 'complete'
                    });
                  }
                  return next;
                });
              } else {
                // Single-file result (existing behavior)
                const finalOriginalCode = originalCode || res.original_code || null;
                const finalResult = {
                  mode: 'single',
                  code: res.code || fullCode,
                  original_code: finalOriginalCode,
                  prompt: res.prompt,
                  validation: agentResults.validator || res.validation,
                  tests: agentResults.testing || agentResults['testing agent'] || res.tests,
                  security: agentResults.security || agentResults['security agent'] || res.security,
                  all_fixes: mergedFixes,
                  code_was_fixed: res.code_was_fixed || mergedFixes.length > 0,
                  total_fixes: res.total_fixes || mergedFixes.reduce((sum, f) => sum + (f.fixes?.length || 0), 0),
                  workflow: res.workflow,
                  stats: { ...res.stats, totalDuration: duration }
                };
                setResult(finalResult);
              }

              setActiveAgent(null);
              break;
            }

            case EventType.RUN_ERROR: {
              setMessages(prev => [...prev, {
                role: 'assistant',
                content: `❌ ${data.message || 'Error generating code. Please try again.'}`
              }]);
              break;
            }

            default:
              break;
          }
        };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const sseLines = chunk.split('\n');

        for (const line of sseLines) {
          if (!line.startsWith('data: ')) continue;
          const data = parseSSEData(line);
          if (!data) continue;
          handleSSEEvent(data);
        }
      }

      const totalFixCount = finalAllFixes.reduce((sum, f) => sum + (f.fixes?.length || 0), 0);
      const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);

      // Determine mode based on what happened during streaming
      const isMultiFile = localProjectPlan !== null;
      const multiFileCount = Object.keys(multiFileContents).length;
      const totalMultiLines = Object.values(multiFileContents).reduce((sum, c) => sum + c.split('\n').length, 0);

      const assistantContent = isMultiFile
        ? `Generated ${multiFileCount} files (${totalMultiLines} lines)${totalFixCount > 0 ? ` with ${totalFixCount} auto-fixes` : ''} in ${totalDuration}s`
        : `Generated ${fullCode.split('\n').length} lines of code${totalFixCount > 0 ? ` with ${totalFixCount} auto-fixes` : ''} in ${totalDuration}s`;

      // Build final result for state
      const finalOriginalCodeForSave = originalCode || result?.original_code || null;

      let savedResult;
      if (isMultiFile) {
        // Multi-file saved result
        const projFiles = (localProjectPlan?.files || []).map(f => ({
          path: f.path,
          content: multiFileContents[f.path] || '',
          language: f.language || 'text',
          purpose: f.purpose || '',
          lines: (multiFileContents[f.path] || '').split('\n').length
        }));

        savedResult = {
          mode: 'multi',
          project_name: localProjectPlan?.project_name || 'project',
          project_files: projFiles,
          all_fixes: finalAllFixes,
          total_fixes: totalFixCount,
          stats: {
            totalDuration: totalDuration,
            totalLines: totalMultiLines,
            totalFiles: multiFileCount,
            totalFixes: totalFixCount
          }
        };
      } else {
        // Single-file saved result
        savedResult = {
          mode: 'single',
          code: fullCode,
          original_code: finalOriginalCodeForSave,
          all_fixes: finalAllFixes,
          code_was_fixed: totalFixCount > 0 || (originalCode && originalCode !== fullCode),
          total_fixes: totalFixCount,
          validation: agentResults.validator,
          tests: agentResults.testing || agentResults['testing agent'],
          security: agentResults.security || agentResults['security agent'],
          stats: {
            totalDuration: totalDuration,
            totalLines: fullCode.split('\n').length,
            totalFixes: totalFixCount
          }
        };
      }

      // Update the result state with final values
      setResult(savedResult);

      const newAssistantMsg = {
        role: 'assistant',
        content: assistantContent,
        code_output: isMultiFile ? JSON.stringify({ mode: 'multi', project_files: savedResult.project_files }) : fullCode,
        workflow_data: {
          mode: isMultiFile ? 'multi' : 'single',
          project_name: isMultiFile ? savedResult.project_name : undefined,
          project_files: isMultiFile ? savedResult.project_files : undefined,
          original_code: isMultiFile ? undefined : savedResult.original_code,
          all_fixes: finalAllFixes,
          code_was_fixed: savedResult.code_was_fixed,
          total_fixes: totalFixCount,
          validation: savedResult.validation,
          tests: savedResult.tests,
          security: savedResult.security,
          stats: savedResult.stats,
          agent_messages: localAgentMessages.slice(-20)
        },
        hasResult: true
      };
      setMessages(prev => {
        const updated = [...prev, newAssistantMsg];
        setSelectedMessageIndex(updated.length - 1);
        return updated;
      });

      if (sessionId && token) {
        try {
          // Build stats object for saving
          const statsToSave = savedResult.stats;

          // Save message with full workflow_data including fixes
          await authAxios.post(`/sessions/${sessionId}/messages`, {
            role: 'assistant',
            content: assistantContent,
            code_output: newAssistantMsg.code_output,
            workflow_data: {
              mode: isMultiFile ? 'multi' : 'single',
              project_name: isMultiFile ? savedResult.project_name : undefined,
              project_files: isMultiFile ? savedResult.project_files : undefined,
              original_code: isMultiFile ? undefined : savedResult.original_code,
              all_fixes: finalAllFixes,
              code_was_fixed: savedResult.code_was_fixed,
              total_fixes: totalFixCount,
              validation: savedResult.validation,
              tests: savedResult.tests,
              security: savedResult.security,
              stats: statsToSave,
              agent_messages: localAgentMessages.slice(-20)
            }
          });
        } catch (error) {
          console.error('Error saving assistant message:', error);
        }
      }

      // Increment guest usage after successful generation
      if (!isAuthenticated) {
        incrementGuestUsage();
      }

    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '❌ Error generating code. Please try again.'
      }]);
    } finally {
      setLoading(false);
      setPrompt('');
      // Trigger completion celebration
      setShowCompletion(true);
      setTimeout(() => setShowCompletion(false), 3000);
    }
  };

  const [copyStatus, setCopyStatus] = useState('');

  const copyCode = async () => {
    const codeToCopy = showOriginal ? result?.original_code : (result?.code || streamingCode);
    if (!codeToCopy) {
      setCopyStatus('No code');
      setTimeout(() => setCopyStatus(''), 2000);
      return;
    }

    // Try multiple methods to copy
    let success = false;

    // Method 1: Modern Clipboard API
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(codeToCopy);
        success = true;
      } catch (err) {
        console.log('Clipboard API failed:', err);
      }
    }

    // Method 2: execCommand fallback
    if (!success) {
      const textArea = document.createElement('textarea');
      textArea.value = codeToCopy;
      textArea.style.position = 'fixed';
      textArea.style.top = '0';
      textArea.style.left = '0';
      textArea.style.width = '2em';
      textArea.style.height = '2em';
      textArea.style.padding = '0';
      textArea.style.border = 'none';
      textArea.style.outline = 'none';
      textArea.style.boxShadow = 'none';
      textArea.style.background = 'transparent';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      try {
        success = document.execCommand('copy');
      } catch (err) {
        console.log('execCommand failed:', err);
      }

      document.body.removeChild(textArea);
    }

    if (success) {
      setCopyStatus('✓ Copied!');
    } else {
      // If all else fails, show code in alert for manual copy
      setCopyStatus('Select & Copy');
      window.prompt('Copy this code (Ctrl+C):', codeToCopy.substring(0, 500) + (codeToCopy.length > 500 ? '...' : ''));
    }
    setTimeout(() => setCopyStatus(''), 2000);
  };

  // ZIP download for multi-file projects
  const downloadZip = async () => {
    const files = result?.project_files || Array.from(projectFiles.entries()).map(([path, f]) => ({
      path, content: f.content
    }));

    if (!files.length) return;

    const zip = new JSZip();
    const projectName = result?.project_name || projectPlan?.project_name || 'project';

    for (const file of files) {
      zip.file(file.path, file.content || '');
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    saveAs(blob, `${projectName}.zip`);
  };

  // Copy active file content (multi-file mode)
  const copyActiveFileCode = async () => {
    const fileData = projectFiles.get(activeFile);
    const code = fileData?.content || '';
    if (!code) return;

    try {
      await navigator.clipboard.writeText(code);
      setCopyStatus('✓ Copied!');
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = code;
      textArea.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopyStatus('✓ Copied!');
    }
    setTimeout(() => setCopyStatus(''), 2000);
  };

  // File selection handler for FileTree
  const handleFileSelect = useCallback((path) => {
    setActiveFile(path);
    if (!openTabs.includes(path)) {
      setOpenTabs(prev => [...prev, path]);
    }
    // Update streaming code to show this file
    const fileData = projectFiles.get(path);
    if (fileData?.content) {
      setStreamingCode(fileData.content);
    }
  }, [openTabs, projectFiles]);

  // Close tab
  const closeTab = useCallback((path, e) => {
    e?.stopPropagation();
    setOpenTabs(prev => {
      const next = prev.filter(p => p !== path);
      if (activeFile === path && next.length > 0) {
        setActiveFile(next[next.length - 1]);
      }
      return next;
    });
  }, [activeFile]);

  // File list for FileTree component (derived from projectFiles state)
  const fileTreeData = useMemo(() => {
    return Array.from(projectFiles.entries()).map(([path, data]) => ({
      path,
      language: data.language || 'text',
      purpose: data.purpose || '',
      lines: data.lines || 0,
      content: data.content || ''
    }));
  }, [projectFiles]);

  // Language detection from file extension
  const getLanguageFromPath = (filePath) => {
    const ext = filePath?.split('.').pop()?.toLowerCase();
    const langMap = {
      js: 'javascript', jsx: 'jsx', ts: 'typescript', tsx: 'tsx',
      py: 'python', html: 'html', css: 'css', scss: 'scss',
      json: 'json', md: 'markdown', yml: 'yaml', yaml: 'yaml',
      sql: 'sql', sh: 'bash', toml: 'toml', xml: 'xml', svg: 'xml'
    };
    return langMap[ext] || 'text';
  };

  const getAgentIcon = (agentId) => {
    const icons = {
      code_generator: '⚡',
      validator: '✓',
      testing: '🧪',
      security: '🛡️'
    };
    const key = agentId?.toLowerCase().replace(' agent', '').replace(' ', '_');
    return icons[key] || '🤖';
  };

  // Handle clicking on a user message to edit
  const handleEditMessage = (index, content) => {
    if (loading) return;
    setEditingMessageIndex(index);
    setEditingContent(content);
  };

  // Handle saving edited message and resubmitting
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingContent.trim() || loading) return;

    // Remove all messages from this point onwards
    setMessages(prev => prev.slice(0, editingMessageIndex));

    // Reset results
    setResult(null);
    setStreamingCode('');
    setAgentMessages([]);

    // Close edit mode
    setEditingMessageIndex(null);

    // Set prompt and trigger submit
    const newPrompt = editingContent;
    setEditingContent('');
    setPrompt(newPrompt);

    // Trigger form submission after state updates
    setTimeout(() => {
      document.querySelector('.input-form')?.requestSubmit();
    }, 50);
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingMessageIndex(null);
    setEditingContent('');
  };

  // Generate a rich description for the code (ChatGPT style)
  const generateDescription = (code, prompt) => {
    if (!code) return null;

    const lines = code.split('\n').length;
    const hasClass = code.includes('class ');
    const hasAsync = code.includes('async ');
    const imports = code.match(/^import |^from /gm)?.length || 0;

    // Extract function/class names
    const classMatch = code.match(/class\s+(\w+)/g)?.map(c => c.replace('class ', '')) || [];
    const funcMatch = code.match(/def\s+(\w+)/g)?.map(f => f.replace('def ', '')).filter(f => !f.startsWith('_')) || [];
    const publicMethods = funcMatch.filter(f => !f.startsWith('__'));

    // Detect patterns
    const hasErrorHandling = code.includes('try:') || code.includes('except');
    const hasLogging = code.includes('logging') || code.includes('logger');
    const hasTypeHints = code.includes(': str') || code.includes(': int') || code.includes('-> ');
    const hasDocstrings = code.includes('"""') || code.includes("'''");
    const hasDecorators = (code.match(/@\w+/g) || []).length > 0;
    const hasDataclass = code.includes('@dataclass');
    const hasValidation = code.includes('raise ') || code.includes('ValueError') || code.includes('assert');

    // Build description
    let desc = {
      title: '',
      summary: '',
      keyPoints: [],
      features: [],
      structure: ''
    };

    // Generate title based on what was requested
    const promptLower = prompt?.toLowerCase() || '';
    if (promptLower.includes('auth')) {
      desc.title = '🔐 Authentication Module';
    } else if (promptLower.includes('api') || promptLower.includes('fetch')) {
      desc.title = '🌐 API Integration';
    } else if (promptLower.includes('database') || promptLower.includes('db')) {
      desc.title = '🗄️ Database Handler';
    } else if (promptLower.includes('rate limit')) {
      desc.title = '⏱️ Rate Limiter';
    } else if (promptLower.includes('cache')) {
      desc.title = '💾 Caching System';
    } else if (promptLower.includes('test')) {
      desc.title = '🧪 Testing Utilities';
    } else if (hasClass && classMatch.length > 0) {
      desc.title = `📦 ${classMatch[0]} Class`;
    } else if (publicMethods.length > 0) {
      desc.title = `⚡ ${publicMethods[0]} Function`;
    } else {
      desc.title = '✨ Generated Code';
    }

    // Generate summary
    if (hasClass && classMatch.length > 0) {
      const className = classMatch[0];
      const methodCount = publicMethods.length;
      desc.summary = `I've created a **${className}** class with ${methodCount} method${methodCount !== 1 ? 's' : ''} that implements ${promptLower.includes('auth') ? 'secure authentication logic' : promptLower.includes('api') ? 'robust API communication' : promptLower.includes('pool') ? 'connection pooling' : 'the requested functionality'}. The code follows Python best practices and includes proper error handling.`;
    } else if (publicMethods.length > 0) {
      desc.summary = `I've implemented a **${publicMethods[0]}** function${publicMethods.length > 1 ? ` along with ${publicMethods.length - 1} helper function${publicMethods.length > 2 ? 's' : ''}` : ''} that ${promptLower.replace(/create|build|write|generate|a |an /gi, '').trim() || 'performs the requested operation'}. The implementation is production-ready with comprehensive error handling.`;
    } else {
      desc.summary = `Here's a Python implementation that ${promptLower.replace(/create|build|write|generate|a |an /gi, '').trim() || 'addresses your requirements'}. The code is structured for maintainability and follows best practices.`;
    }

    // Key implementation points
    if (hasClass && classMatch.length > 0) {
      desc.keyPoints.push(`**${classMatch[0]}** - Main class encapsulating the logic`);
    }
    if (publicMethods.length > 0) {
      const mainMethods = publicMethods.slice(0, 3);
      mainMethods.forEach(m => {
        desc.keyPoints.push(`\`${m}()\` - ${m.includes('init') ? 'Initializes the instance' : m.includes('get') ? 'Retrieves data' : m.includes('set') ? 'Updates configuration' : m.includes('validate') ? 'Validates input' : m.includes('create') ? 'Creates new resource' : m.includes('delete') ? 'Removes resource' : m.includes('update') ? 'Updates existing data' : 'Core functionality'}`);
      });
    }

    // Features detected
    if (hasAsync) desc.features.push('**Async/await** for non-blocking I/O operations');
    if (hasErrorHandling) desc.features.push('**Exception handling** with proper error recovery');
    if (hasTypeHints) desc.features.push('**Type hints** for better IDE support and documentation');
    if (hasDocstrings) desc.features.push('**Docstrings** explaining function behavior');
    if (hasLogging) desc.features.push('**Logging** for debugging and monitoring');
    if (hasDecorators) desc.features.push('**Decorators** for clean, reusable patterns');
    if (hasValidation) desc.features.push('**Input validation** preventing bad data');
    if (hasDataclass) desc.features.push('**Dataclasses** for clean data structures');
    if (code.includes('hashlib') || code.includes('bcrypt')) desc.features.push('**Secure hashing** for sensitive data');
    if (code.includes('retry') || code.includes('backoff')) desc.features.push('**Retry logic** with exponential backoff');
    if (code.includes('threading') || code.includes('asyncio')) desc.features.push('**Concurrency** support built-in');

    // Structure info
    desc.structure = `${lines} lines • ${imports} import${imports !== 1 ? 's' : ''}${classMatch.length ? ` • ${classMatch.length} class${classMatch.length > 1 ? 'es' : ''}` : ''}${publicMethods.length ? ` • ${publicMethods.length} function${publicMethods.length > 1 ? 's' : ''}` : ''}`;

    return desc;
  };

  // Normalize agent name to consistent format
  const normalizeAgentName = (name) => {
    if (!name) return 'Unknown';
    const lower = name.toLowerCase().replace(' agent', '').replace('_', ' ');
    // Capitalize first letter
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  };

  // Deduplicate and merge fixes by normalized agent name
  const deduplicateFixes = (fixes) => {
    const merged = {};
    for (const item of fixes) {
      const normalizedName = normalizeAgentName(item.agent);
      if (!merged[normalizedName]) {
        merged[normalizedName] = { agent: normalizedName, fixes: [] };
      }
      // Add fixes if not already present (check by description)
      const existingDescs = new Set(merged[normalizedName].fixes.map(f =>
        typeof f === 'object' ? f.description : f
      ));
      for (const fix of (item.fixes || [])) {
        const desc = typeof fix === 'object' ? fix.description : fix;
        if (!existingDescs.has(desc)) {
          merged[normalizedName].fixes.push(fix);
          existingDescs.add(desc);
        }
      }
    }
    return Object.values(merged).filter(m => m.fixes.length > 0);
  };

  // Calculate deduplicated total fixes
  const deduplicatedFixes = result?.all_fixes ? deduplicateFixes(result.all_fixes) : [];
  const totalFixes = deduplicatedFixes.reduce((sum, f) => sum + (f.fixes?.length || 0), 0);

  return (
    <div className={`genui-v2 ${isResizing ? 'resizing' : ''}`}>
      {/* Minimal Sidebar */}
      <aside className="genui-v2-sidebar">
        <div className="sidebar-brand">
          <Link to="/" className="brand-link">
            <span className="brand-icon">🚀</span>
            <span className="brand-text">Uber Code</span>
          </Link>
        </div>

        <nav className="sidebar-actions">
          <button className="action-btn primary" onClick={createSession}>
            <span>+</span>
            <span>New</span>
          </button>
          <Link to="/dashboard" className="action-btn">
            <span>📊</span>
            <span>History</span>
          </Link>
        </nav>

        <div className="sidebar-footer">
          <UserMenu />
        </div>
      </aside>

      {/* Main Chat Area */}
      <main
        className={`genui-v2-main ${showRightPanel && (streamingCode || result || projectFiles.size > 0) ? 'with-panel' : ''}`}
        style={showRightPanel && (streamingCode || result || projectFiles.size > 0) ? { maxWidth: `calc(100vw - 72px - ${panelWidth}px)` } : {}}
      >
        {/* Header */}
        <header className="main-header">
          <div className="header-title">
            <h1>{sessionTitle}</h1>
            <Badge variant="primary" size="sm">GenUI</Badge>
          </div>
          {(streamingCode || result || projectFiles.size > 0) && (
            <button
              className="panel-toggle"
              onClick={() => setShowRightPanel(!showRightPanel)}
            >
              {showRightPanel ? '◀ Hide Panel' : '▶ Show Panel'}
            </button>
          )}
        </header>

        {/* Floating Workflow Indicator */}
        {loading && (
          <motion.div
            className="floating-workflow"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="workflow-steps">
              {(projectMode === 'multi'
                ? [
                    { label: 'Plan', agent: 'planning', icon: '📋' },
                    { label: 'Generate', agent: 'code_generator', icon: '⚡' },
                    { label: 'Validate', agent: 'validator', icon: '✓' },
                    { label: 'Test', agent: 'testing', icon: '🧪' },
                    { label: 'Secure', agent: 'security', icon: '🛡️' }
                  ]
                : [
                    { label: 'Code Gen', agent: 'code_generator', icon: '⚡' },
                    { label: 'Validate', agent: 'validator', icon: '✓' },
                    { label: 'Test', agent: 'testing', icon: '🧪' },
                    { label: 'Secure', agent: 'security', icon: '🛡️' }
                  ]
              ).map((step, i, arr) => {
                const isActive = activeAgent?.toLowerCase().includes(step.agent.split('_')[0]);
                const isDone = agentMessages.some(m =>
                  m.agent?.toLowerCase().includes(step.agent.split('_')[0]) && m.type === 'result'
                );
                return (
                  <React.Fragment key={step.label}>
                    <div className={`workflow-step ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}>
                      <span className="step-icon">{isDone ? '✓' : step.icon}</span>
                      <span className="step-name">{step.label}</span>
                    </div>
                    {i < arr.length - 1 && (
                      <div className={`workflow-connector ${isDone ? 'filled' : ''} ${isActive ? 'active' : ''}`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Messages */}
        <div className="messages-container">
          {messages.length === 0 && !loading && (
            <div className="welcome-screen">
              <div className="welcome-content">
                <div className="welcome-icon">✨</div>
                <h2>Uber Code Generator</h2>
                <p>AI-powered code generation with real-time Generative UI</p>

                <div className="quick-prompts">
                  <h4>Quick Start</h4>
                  <div className="prompt-grid">
                    <button onClick={() => setPrompt('Create a Python function to fetch API data with retry logic and error handling')}>
                      <span>🔄</span>
                      <span>API with Retry</span>
                    </button>
                    <button onClick={() => setPrompt('Create a user authentication class with password hashing')}>
                      <span>🔐</span>
                      <span>Auth Class</span>
                    </button>
                    <button onClick={() => setPrompt('Build a Flask REST API with user authentication, database models, and rate limiting')}>
                      <span>📦</span>
                      <span>Flask API Project</span>
                    </button>
                    <button onClick={() => setPrompt('Create a React todo app with components, styling, and local storage')}>
                      <span>⚛️</span>
                      <span>React Todo App</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="messages-list">
            {messages.map((msg, index) => (
              <motion.div
                key={index}
                className={`message ${msg.role} ${editingMessageIndex === index ? 'editing' : ''} ${msg.role === 'assistant' && msg.hasResult && selectedMessageIndex === index ? 'selected' : ''} ${msg.role === 'assistant' && msg.hasResult ? 'clickable' : ''}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => msg.role === 'assistant' && msg.hasResult && selectMessage(index)}
              >
                <div className="message-avatar">
                  {msg.role === 'user' ? '👤' : '🤖'}
                </div>
                <div className="message-body">
                  {/* Editable user message */}
                  {msg.role === 'user' && editingMessageIndex === index ? (
                    <form className="edit-message-form" onSubmit={handleSaveEdit}>
                      <textarea
                        value={editingContent}
                        onChange={(e) => setEditingContent(e.target.value)}
                        autoFocus
                        rows={3}
                      />
                      <div className="edit-actions">
                        <button type="button" className="cancel-btn" onClick={handleCancelEdit}>
                          Cancel
                        </button>
                        <button type="submit" className="save-btn" disabled={!editingContent.trim()}>
                          Save & Submit
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <p>{msg.content}</p>
                      {msg.role === 'user' && !loading && (
                        <button
                          className="edit-message-btn"
                          onClick={() => handleEditMessage(index, msg.content)}
                          title="Edit message"
                        >
                          ✏️
                        </button>
                      )}
                    </>
                  )}

                  {/* Code description for assistant messages with results */}
                  {msg.role === 'assistant' && msg.hasResult && msg.code_output && (() => {
                    const desc = generateDescription(msg.code_output, messages[index - 1]?.content);
                    const msgFixes = msg.workflow_data?.all_fixes || [];
                    const msgTotalFixes = msgFixes.reduce((sum, f) => sum + (f.fixes?.length || 0), 0);
                    return desc ? (
                      <div className="code-description">
                        <div className="desc-header">
                          <span className="desc-title">{desc.title}</span>
                        </div>
                        <p className="desc-summary" dangerouslySetInnerHTML={{
                          __html: desc.summary.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        }} />

                        {desc.keyPoints.length > 0 && (
                          <div className="desc-key-points">
                            <span className="section-label">Key Components:</span>
                            <ul>
                              {desc.keyPoints.map((point, i) => (
                                <li key={i} dangerouslySetInnerHTML={{
                                  __html: point.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/`(.*?)`/g, '<code>$1</code>')
                                }} />
                              ))}
                            </ul>
                          </div>
                        )}

                        {desc.features.length > 0 && (
                          <div className="desc-features-section">
                            <span className="section-label">Features:</span>
                            <ul className="desc-features">
                              {desc.features.slice(0, 5).map((feat, i) => (
                                <li key={i} dangerouslySetInnerHTML={{
                                  __html: feat.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                }} />
                              ))}
                            </ul>
                          </div>
                        )}

                        <div className="desc-footer">
                          <span className="desc-structure">{desc.structure}</span>
                          {msgTotalFixes > 0 && (
                            <span className="desc-fixes">🔧 {msgTotalFixes} auto-fixes applied</span>
                          )}
                        </div>
                      </div>
                    ) : null;
                  })()}
                </div>
              </motion.div>
            ))}

            {loading && (
              <motion.div
                className="message assistant"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <div className="message-avatar">🤖</div>
                <div className="message-body">
                  <div className="typing-indicator">
                    <span className="typing-text">
                      {activeAgent ? `${getAgentIcon(activeAgent)} ${activeAgent}` : 'Processing'}
                    </span>
                    <span className="typing-dots">
                      <span>.</span><span>.</span><span>.</span>
                    </span>
                  </div>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div className="input-container">
          <form onSubmit={handleSubmit} className="input-form">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the code you want to generate..."
              disabled={loading}
            />
            <button type="submit" disabled={loading || !prompt.trim()}>
              {loading ? (
                <span className="spinner"></span>
              ) : (
                <span>→</span>
              )}
            </button>
          </form>
          <p className="input-hint">Powered by Llama 3.3 via Groq • Smart single/multi-file detection • 5 AI Agents</p>
        </div>
      </main>

      {/* Right Panel - Results */}
      <AnimatePresence>
        {showRightPanel && (streamingCode || result || projectFiles.size > 0) && (
          <>
            {/* Resize Handle */}
            <div
              className={`panel-resize-handle ${isResizing ? 'active' : ''}`}
              onMouseDown={startResize}
            >
              <div className="resize-grip">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>

            <motion.aside
              className="genui-v2-panel"
              style={{ width: panelWidth }}
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: panelWidth, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={isResizing ? { duration: 0 } : { duration: 0.2 }}
            >
              {/* Panel Tabs */}
              <div className="panel-tabs">
                <button
                  className={rightPanelTab === 'code' ? 'active' : ''}
                  onClick={() => setRightPanelTab('code')}
                >
                  <span>📝</span> Code
                  {loading && <span className="live-dot"></span>}
                </button>
                <button
                  className={rightPanelTab === 'agents' ? 'active' : ''}
                  onClick={() => setRightPanelTab('agents')}
                >
                  <span>🤖</span> Agents
                  {agentMessages.length > 0 && <span className="count">{agentMessages.length}</span>}
                </button>
                <button
                  className={rightPanelTab === 'fixes' ? 'active' : ''}
                  onClick={() => setRightPanelTab('fixes')}
                >
                  <span>🔧</span> Fixes
                  {totalFixes > 0 && <span className="count">{totalFixes}</span>}
                </button>
              </div>

              {/* Panel Content */}
              <div className="panel-content">
                {/* Code Tab */}
                {rightPanelTab === 'code' && (
                  <>
                    {projectMode === 'multi' ? (
                      /* ===== MULTI-FILE CODE PANEL ===== */
                      <div className="multi-file-panel">
                        {/* Project plan banner */}
                        {projectPlan && (
                          <div className="project-plan-banner">
                            <span className="plan-icon">📦</span>
                            <div className="plan-info">
                              <div className="plan-title">{projectPlan.project_name || 'Project'}</div>
                              <div className="plan-desc">{projectPlan.description || ''}</div>
                            </div>
                            <div className="plan-stats">
                              <div className="plan-stat">
                                <div className="plan-stat-value">{projectPlan.files?.length || 0}</div>
                                <div className="plan-stat-label">Files</div>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="multi-file-split">
                          {/* File tree sidebar */}
                          <div className="multi-file-tree-pane">
                            <FileTree
                              files={fileTreeData}
                              activeFile={activeFile}
                              onFileSelect={handleFileSelect}
                              streamingFile={streamingFile}
                              completedFiles={completedFiles}
                              projectName={projectPlan?.project_name || result?.project_name || 'Project'}
                            />
                          </div>

                          {/* Editor pane */}
                          <div className="multi-file-editor-pane">
                            {/* File tabs */}
                            <div className="file-tabs">
                              {openTabs.map(tabPath => {
                                const fileName = tabPath.split('/').pop();
                                return (
                                  <button
                                    key={tabPath}
                                    className={`file-tab ${activeFile === tabPath ? 'active' : ''}`}
                                    onClick={() => handleFileSelect(tabPath)}
                                  >
                                    <span className="tab-name">{fileName}</span>
                                    {openTabs.length > 1 && (
                                      <span className="tab-close" onClick={(e) => closeTab(tabPath, e)}>×</span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>

                            {/* File header with actions */}
                            <div className="code-header">
                              <div className="code-stats">
                                <span>{activeFile || 'No file selected'}</span>
                                {activeFile && projectFiles.get(activeFile) && (
                                  <Badge variant="primary" size="sm">
                                    {projectFiles.get(activeFile)?.lines || 0} lines
                                  </Badge>
                                )}
                              </div>
                              <div className="code-actions">
                                <button onClick={copyActiveFileCode}>
                                  {copyStatus || 'Copy'}
                                </button>
                                {!loading && (result?.project_files?.length > 0 || projectFiles.size > 0) && (
                                  <button className="download-zip-btn" onClick={downloadZip}>
                                    📥 Download ZIP
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Code viewer */}
                            <div className={`multi-file-code-view ${loading && streamingFile === activeFile ? 'streaming' : ''}`}>
                              <CodeBlock
                                code={projectFiles.get(activeFile)?.content || streamingCode || '// Select a file...'}
                                language={getLanguageFromPath(activeFile)}
                                lineNumbers={true}
                                maxHeight="calc(100vh - 320px)"
                              />
                              {loading && streamingFile === activeFile && <span className="streaming-cursor" />}
                            </div>

                            {/* File progress bar */}
                            {loading && (
                              <div className="file-progress-bar">
                                <span className="progress-text">
                                  {streamingFile
                                    ? `⚡ Generating ${streamingFile}...`
                                    : `✓ ${completedFiles.size}/${projectPlan?.files?.length || 0} files`
                                  }
                                </span>
                                <div className="progress-track">
                                  <div
                                    className="progress-fill"
                                    style={{ width: `${projectPlan?.files?.length ? (completedFiles.size / projectPlan.files.length) * 100 : 0}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {showCompletion && (
                          <div className="completion-badge">
                            <svg className="checkmark" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M5 13l4 4L19 7" />
                            </svg>
                            Project Generated
                          </div>
                        )}
                      </div>
                    ) : (
                      /* ===== SINGLE-FILE CODE PANEL ===== */
                      <div className="code-panel">
                        <div className="code-header">
                          <div className="code-stats">
                            <span>{streamingStats.lines || result?.code?.split('\n').length || 0} lines</span>
                            {result?.code_was_fixed && (
                              <Badge variant="success" size="sm">✓ Fixed</Badge>
                            )}
                          </div>
                          <div className="code-actions">
                            {result?.original_code && (
                              <button onClick={() => setShowOriginal(!showOriginal)}>
                                {showOriginal ? 'Show Fixed' : 'Show Original'}
                              </button>
                            )}
                            <button onClick={copyCode}>
                              {copyStatus || 'Copy'}
                            </button>
                          </div>
                        </div>

                        <div className={`code-view ${loading ? 'streaming' : ''} ${showCompletion ? 'completion-flash' : ''}`}>
                          <CodeBlock
                            code={showOriginal ? result?.original_code : (result?.code || streamingCode)}
                            language="python"
                            lineNumbers={true}
                            maxHeight="calc(100vh - 250px)"
                          />
                          {loading && <span className="streaming-cursor" />}
                        </div>

                        {loading && (
                          <div className="streaming-bar">
                            <span className="pulse">●</span>
                            <span>Streaming... {streamingStats.lines} lines</span>
                          </div>
                        )}

                        {showCompletion && (
                          <div className="completion-badge">
                            <svg className="checkmark" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M5 13l4 4L19 7" />
                            </svg>
                            Generation Complete
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}

                {/* Agents Tab */}
                {rightPanelTab === 'agents' && (
                  <div className="agents-panel">
                    {/* Stats Row */}
                    {result && (
                      <div className="stats-row">
                        <div className="stat-item">
                          <span className="stat-value">
                            {result.mode === 'multi'
                              ? result.stats?.totalLines || 0
                              : result.code?.split('\n').length || 0
                            }
                          </span>
                          <span className="stat-label">Lines</span>
                        </div>
                        {result.mode === 'multi' && (
                          <div className="stat-item">
                            <span className="stat-value">{result.stats?.totalFiles || 0}</span>
                            <span className="stat-label">Files</span>
                          </div>
                        )}
                        <div className="stat-item">
                          <span className="stat-value">{totalFixes}</span>
                          <span className="stat-label">Fixes</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-value">
                            {result.stats?.totalDuration ? `${result.stats.totalDuration}s` : '-'}
                          </span>
                          <span className="stat-label">Time</span>
                        </div>
                      </div>
                    )}

                    {/* Agent Feed - Deduplicated */}
                    <div className="agent-feed">
                      <AnimatePresence>
                        {(() => {
                          // Deduplicate agent messages by normalizing names and keeping latest
                          const seen = new Map();
                          const deduped = [];
                          for (const msg of agentMessages) {
                            const key = `${normalizeAgentName(msg.agent)}-${msg.type}`;
                            if (!seen.has(key) || msg.type === 'result') {
                              seen.set(key, deduped.length);
                              deduped.push({ ...msg, agent: normalizeAgentName(msg.agent) });
                            }
                          }
                          return deduped;
                        })().map((msg, i) => (
                          <motion.div
                            key={i}
                            className={`agent-item ${msg.type}`}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.03 }}
                          >
                            <span className="agent-icon">{getAgentIcon(msg.agent)}</span>
                            <div className="agent-info">
                              <span className="agent-name">{msg.agent}</span>
                              <span className="agent-msg">{msg.message}</span>
                            </div>
                            <span className="agent-time">{msg.time}</span>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>

                    {/* Agent Results */}
                    {result && (
                      <div className="agent-results">
                        <Tabs
                          tabs={[
                            {
                              id: 'validation',
                              label: 'Validator',
                              icon: '✓',
                              content: (
                                <div className="agent-detail">
                                  <p>{result.validation?.message || 'Code validated'}</p>
                                  {result.validation?.fixes_applied?.length > 0 && (
                                    <Badge variant="success">{result.validation.fixes_applied.length} fixes</Badge>
                                  )}
                                </div>
                              )
                            },
                            {
                              id: 'testing',
                              label: 'Testing',
                              icon: '🧪',
                              content: (
                                <div className="agent-detail">
                                  <p>{result.tests?.message || 'Tests passed'}</p>
                                  {result.tests?.testability_score && (
                                    <Badge variant="primary">Score: {result.tests.testability_score}</Badge>
                                  )}
                                </div>
                              )
                            },
                            {
                              id: 'security',
                              label: 'Security',
                              icon: '🛡️',
                              content: (
                                <div className="agent-detail">
                                  <p>{result.security?.message || 'No vulnerabilities'}</p>
                                  {result.security?.risk_level && (
                                    <Badge variant={result.security.risk_level === 'low' ? 'success' : 'warning'}>
                                      Risk: {result.security.risk_level}
                                    </Badge>
                                  )}
                                </div>
                              )
                            }
                          ]}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Fixes Tab */}
                {rightPanelTab === 'fixes' && (
                  <div className="fixes-panel">
                    {result?.all_fixes && result.all_fixes.length > 0 ? (
                      <div className="fixes-list">
                        {deduplicateFixes(result.all_fixes).map((agentFix, i) => (
                          <Expandable
                            key={i}
                            title={`${agentFix.agent} (${agentFix.fixes?.length || 0})`}
                            icon={getAgentIcon(agentFix.agent)}
                            expanded={i === 0}
                          >
                            {agentFix.fixes?.map((fix, j) => (
                              <FixCard
                                key={j}
                                agent={agentFix.agent}
                                description={typeof fix === 'object' ? fix.description : fix}
                                severity={fix.severity || 'medium'}
                                before={fix.before}
                                after={fix.after}
                                line={fix.line}
                                expandable={true}
                              />
                            ))}
                          </Expandable>
                        ))}
                      </div>
                    ) : (
                      <div className="empty-state">
                        <span>✓</span>
                        <p>No fixes needed - code generated cleanly!</p>
                      </div>
                    )}

                    {/* Code Diff */}
                    {result?.code_was_fixed && result?.original_code && (
                      <div className="diff-section">
                        <h4>Full Diff</h4>
                        <CodeDiff
                          before={result.original_code}
                          after={result.code}
                          title=""
                          expanded={false}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Usage Limit Modal for guests */}
      <UsageLimitModal
        isOpen={showUsageLimitModal}
        onClose={() => setShowUsageLimitModal(false)}
        onSignInSuccess={() => {
          setShowUsageLimitModal(false);
          // User is now authenticated, they can continue
        }}
      />
    </div>
  );
};

export default GenUIChatPageV2;
