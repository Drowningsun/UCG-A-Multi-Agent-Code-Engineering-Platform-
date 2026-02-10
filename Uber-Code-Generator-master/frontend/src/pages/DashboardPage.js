import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import UserMenu from '../components/UserMenu';
import ConfirmModal from '../components/ConfirmModal';
import ScrollReveal, { StaggerContainer, StaggerItem } from '../components/ScrollReveal';
import AnimatedCounter from '../components/AnimatedCounter';
import ParticleNetwork from '../components/ParticleNetwork';
import SpotlightCard from '../components/SpotlightCard';
import './DashboardPage.css';

const DashboardPage = () => {
  const { authAxios, user, isAuthenticated } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedSessions, setSelectedSessions] = useState(new Set());

  // Confirm modal state
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { },
    variant: 'danger'
  });

  const closeConfirmModal = () => {
    setConfirmModal(prev => ({ ...prev, isOpen: false }));
  };

  const fetchSessions = useCallback(async () => {
    try {
      const response = await authAxios.get('/sessions');
      setSessions(response.data);
    } catch (error) {
      console.error('Error fetching sessions:', error);
    } finally {
      setLoading(false);
    }
  }, [authAxios]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchSessions();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, fetchSessions]);

  const toggleSelectMode = () => {
    setSelectMode(!selectMode);
    setSelectedSessions(new Set());
  };

  const toggleSessionSelection = (sessionId, e) => {
    e.preventDefault();
    e.stopPropagation();
    const newSelected = new Set(selectedSessions);
    if (newSelected.has(sessionId)) {
      newSelected.delete(sessionId);
    } else {
      newSelected.add(sessionId);
    }
    setSelectedSessions(newSelected);
  };

  const selectAll = () => {
    if (selectedSessions.size === sessions.length) {
      setSelectedSessions(new Set());
    } else {
      setSelectedSessions(new Set(sessions.map(s => s.session_id)));
    }
  };

  const deleteSelectedSessions = () => {
    if (selectedSessions.size === 0) return;

    setConfirmModal({
      isOpen: true,
      title: 'Delete Selected Sessions',
      message: `Are you sure you want to delete ${selectedSessions.size} selected session(s)? This action cannot be undone.`,
      variant: 'danger',
      onConfirm: async () => {
        try {
          await authAxios.post('/sessions/bulk-delete', {
            session_ids: Array.from(selectedSessions)
          });
          setSessions(prev => prev.filter(s => !selectedSessions.has(s.session_id)));
          setSelectedSessions(new Set());
          setSelectMode(false);
        } catch (error) {
          console.error('Error deleting sessions:', error);
        }
      }
    });
  };

  const cleanupEmptySessions = () => {
    const emptySessions = sessions.filter(s => s.message_count === 0);
    if (emptySessions.length === 0) {
      setConfirmModal({
        isOpen: true,
        title: 'No Empty Sessions',
        message: 'There are no empty sessions to clean up.',
        variant: 'info',
        onConfirm: () => { }
      });
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Clean Up Empty Sessions',
      message: `Are you sure you want to delete ${emptySessions.length} empty session(s)? This action cannot be undone.`,
      variant: 'warning',
      onConfirm: async () => {
        try {
          await authAxios.post('/sessions/cleanup-empty');
          setSessions(prev => prev.filter(s => s.message_count > 0));
        } catch (error) {
          console.error('Error cleaning up sessions:', error);
        }
      }
    });
  };

  const deleteSession = (sessionId, e) => {
    e.preventDefault();
    e.stopPropagation();

    const session = sessions.find(s => s.session_id === sessionId);
    setConfirmModal({
      isOpen: true,
      title: 'Delete Session',
      message: `Are you sure you want to delete "${session?.title || 'New Chat'}"? This action cannot be undone.`,
      variant: 'danger',
      onConfirm: async () => {
        try {
          await authAxios.delete(`/sessions/${sessionId}`);
          setSessions(prev => prev.filter(s => s.session_id !== sessionId));
        } catch (error) {
          console.error('Error deleting session:', error);
        }
      }
    });
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;

    // Less than 24 hours
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      if (hours < 1) {
        const minutes = Math.floor(diff / 60000);
        return minutes < 1 ? 'Just now' : `${minutes}m ago`;
      }
      return `${hours}h ago`;
    }

    // Less than 7 days
    if (diff < 604800000) {
      const days = Math.floor(diff / 86400000);
      return days === 1 ? 'Yesterday' : `${days} days ago`;
    }

    return date.toLocaleDateString();
  };

  const agents = [
    { name: 'Code Generator', icon: '⚡', status: 'active', description: 'Generates code from natural language' },
    { name: 'Validator', icon: '✓', status: 'active', description: 'Checks code quality and style' },
    { name: 'Testing Agent', icon: '🧪', status: 'active', description: 'Runs automated tests' },
    { name: 'Security Agent', icon: '🛡️', status: 'active', description: 'Scans for vulnerabilities' }
  ];

  return (
    <div className="dashboard-page">
      <ParticleNetwork />
      {/* Header */}
      <header className="dashboard-header">
        <div className="container header-content">
          <Link to="/" className="logo">
            <span className="logo-icon">🚀</span>
            <span>Uber Code Generator</span>
          </Link>
          <nav className="nav">
            <Link to="/chat" className="btn btn-primary">New Generation</Link>
            {user && <UserMenu />}
          </nav>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="container">
          {/* Stats Section */}
          <section className="stats-section">
            <ScrollReveal direction="fadeUp">
              <h1>Dashboard</h1>
            </ScrollReveal>
            <StaggerContainer staggerDelay={0.1} className="stats-grid">
              <StaggerItem direction="fadeUp">
                <SpotlightCard className="stat-card" spotlightColor="rgba(249, 115, 22, 0.15)">
                  <div className="stat-icon">📊</div>
                  <div className="stat-info">
                    <span className="stat-value"><AnimatedCounter target={sessions.length} duration={800} /></span>
                    <span className="stat-label">Total Sessions</span>
                  </div>
                </SpotlightCard>
              </StaggerItem>
              <StaggerItem direction="fadeUp">
                <SpotlightCard className="stat-card" spotlightColor="rgba(249, 115, 22, 0.15)">
                  <div className="stat-icon">💬</div>
                  <div className="stat-info">
                    <span className="stat-value"><AnimatedCounter target={sessions.filter(s => s.message_count > 0).length} duration={800} /></span>
                    <span className="stat-label">Active Chats</span>
                  </div>
                </SpotlightCard>
              </StaggerItem>
              <StaggerItem direction="fadeUp">
                <SpotlightCard className="stat-card" spotlightColor="rgba(249, 115, 22, 0.15)">
                  <div className="stat-icon">✨</div>
                  <div className="stat-info">
                    <span className="stat-value"><AnimatedCounter target={sessions.reduce((acc, s) => acc + (s.message_count || 0), 0)} duration={1200} /></span>
                    <span className="stat-label">Total Messages</span>
                  </div>
                </SpotlightCard>
              </StaggerItem>
              <StaggerItem direction="fadeUp">
                <SpotlightCard className="stat-card" spotlightColor="rgba(249, 115, 22, 0.15)">
                  <div className="stat-icon">🤖</div>
                  <div className="stat-info">
                    <span className="stat-value"><AnimatedCounter target={4} duration={600} /></span>
                    <span className="stat-label">Active Agents</span>
                  </div>
                </SpotlightCard>
              </StaggerItem>
            </StaggerContainer>
          </section>

          {/* Agents Section */}
          <section className="agents-section">
            <ScrollReveal direction="fadeUp">
              <h2>Agent Status</h2>
            </ScrollReveal>
            <StaggerContainer staggerDelay={0.12} className="agents-grid">
              {agents.map((agent, index) => (
                <StaggerItem key={index} direction="fadeUp">
                  <SpotlightCard className="agent-card" spotlightColor="rgba(249, 115, 22, 0.1)">
                    <div className="agent-icon">{agent.icon}</div>
                    <div className="agent-info">
                      <h3>{agent.name}</h3>
                      <p>{agent.description}</p>
                    </div>
                    <div className={`agent-status ${agent.status}`}>
                      <span className="status-dot"></span>
                      {agent.status}
                    </div>
                  </SpotlightCard>
                </StaggerItem>
              ))}
            </StaggerContainer>
          </section>

          {/* Workflow Diagram */}
          <section className="workflow-section">
            <ScrollReveal direction="fadeUp">
              <h2>Agent Orchestration Flow</h2>
            </ScrollReveal>
            <ScrollReveal direction="scaleIn" delay={0.2}>
              <div className="workflow-diagram">
                <div className="workflow-node start">
                  <span>📝</span>
                  <label>User Prompt</label>
                </div>
                <div className="workflow-arrow">→</div>
                <div className="workflow-node">
                  <span>⚡</span>
                  <label>Code Gen</label>
                </div>
                <div className="workflow-arrow">→</div>
                <div className="workflow-node">
                  <span>✓</span>
                  <label>Validate</label>
                </div>
                <div className="workflow-arrow">→</div>
                <div className="workflow-node">
                  <span>🧪</span>
                  <label>Test</label>
                </div>
                <div className="workflow-arrow">→</div>
                <div className="workflow-node">
                  <span>🛡️</span>
                  <label>Secure</label>
                </div>
                <div className="workflow-arrow">→</div>
                <div className="workflow-node end">
                  <span>✅</span>
                  <label>Output</label>
                </div>
              </div>
            </ScrollReveal>
          </section>

          {/* Sessions Section */}
          <section className="sessions-section">
            <div className="sessions-header">
              <h2>Recent Sessions</h2>
              {isAuthenticated && sessions.length > 0 && (
                <div className="sessions-actions">
                  {selectMode ? (
                    <>
                      <button className="btn btn-sm btn-secondary" onClick={selectAll}>
                        {selectedSessions.size === sessions.length ? 'Deselect All' : 'Select All'}
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={deleteSelectedSessions}
                        disabled={selectedSessions.size === 0}
                      >
                        🗑️ Delete ({selectedSessions.size})
                      </button>
                      <button className="btn btn-sm btn-secondary" onClick={toggleSelectMode}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="btn btn-sm btn-secondary" onClick={toggleSelectMode}>
                        ☑️ Select
                      </button>
                      <button className="btn btn-sm btn-secondary" onClick={cleanupEmptySessions}>
                        🧹 Clean Empty
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
            {!isAuthenticated ? (
              <div className="empty-state">
                <p>Sign in to view your chat history</p>
                <Link to="/login" className="btn btn-primary">Sign In</Link>
              </div>
            ) : loading ? (
              <div className="loading">Loading sessions...</div>
            ) : sessions.length === 0 ? (
              <div className="empty-state">
                <p>No sessions yet. Start generating code!</p>
                <Link to="/chat" className="btn btn-primary">Start Now</Link>
              </div>
            ) : (
              <div className="sessions-list">
                {sessions.map((session) => (
                  <div
                    key={session.session_id}
                    className={`session-card ${selectMode ? 'select-mode' : ''} ${selectedSessions.has(session.session_id) ? 'selected' : ''} ${session.message_count === 0 ? 'empty-session' : ''}`}
                    onClick={selectMode ? (e) => toggleSessionSelection(session.session_id, e) : undefined}
                  >
                    {selectMode && (
                      <div className="session-checkbox">
                        <input
                          type="checkbox"
                          checked={selectedSessions.has(session.session_id)}
                          onChange={(e) => toggleSessionSelection(session.session_id, e)}
                        />
                      </div>
                    )}
                    {!selectMode ? (
                      <Link to={`/chat/${session.session_id}`} className="session-link">
                        <div className="session-icon">💬</div>
                        <div className="session-info">
                          <span className="session-title">{session.title || 'New Chat'}</span>
                          <span className="session-date">
                            {formatDate(session.updated_at || session.created_at)}
                          </span>
                        </div>
                        <div className="session-meta">
                          <span className={`message-count ${session.message_count === 0 ? 'empty' : ''}`}>
                            {session.message_count === 0 ? 'Empty' : `${session.message_count} messages`}
                          </span>
                          <button
                            className="delete-session-btn"
                            onClick={(e) => deleteSession(session.session_id, e)}
                            title="Delete session"
                          >
                            🗑️
                          </button>
                        </div>
                      </Link>
                    ) : (
                      <>
                        <div className="session-icon">💬</div>
                        <div className="session-info">
                          <span className="session-title">{session.title || 'New Chat'}</span>
                          <span className="session-date">
                            {formatDate(session.updated_at || session.created_at)}
                          </span>
                        </div>
                        <div className="session-meta">
                          <span className={`message-count ${session.message_count === 0 ? 'empty' : ''}`}>
                            {session.message_count === 0 ? 'Empty' : `${session.message_count} messages`}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={closeConfirmModal}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
        confirmText={confirmModal.variant === 'info' ? 'OK' : 'Delete'}
        cancelText={confirmModal.variant === 'info' ? 'Close' : 'Cancel'}
      />
    </div>
  );
};

export default DashboardPage;
