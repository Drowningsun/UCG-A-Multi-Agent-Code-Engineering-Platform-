import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import UserMenu from '../components/UserMenu';
import Ballpit from '../components/Ballpit';
import ScrollReveal, { StaggerContainer, StaggerItem } from '../components/ScrollReveal';
import Typewriter from '../components/Typewriter';
import AgentPipeline from '../components/AgentPipeline';
import FeaturesSection from '../components/FeaturesSection';
import './LandingPage.css';

const LandingPage = () => {
  const { isAuthenticated } = useAuth();

  return (
    <div className="landing-page">
      {/* Fixed Ballpit Background */}
      <div className="hero-liquid-chrome">
        <Ballpit
          count={100}
          gravity={0.01}
          friction={0.9975}
          wallBounce={0.95}
          followCursor={false}
          colors={[0x3333ff, 0x5555ff, 0x8844ff, 0xcccccc, 0xffffff]}
          lightIntensity={300}
          ambientIntensity={1.5}
          materialParams={{
            metalness: 0.6,
            roughness: 0.3,
            clearcoat: 1,
            clearcoatRoughness: 0.1
          }}
        />
      </div>

      {/* Header */}
      <header className="header">
        <div className="container header-content">
          <div className="logo">
            <span className="logo-icon">🤖</span>
            <span className="logo-text">Uber Code Generator</span>
          </div>
          <nav className="nav">
            <a href="#features">Features</a>
            <a href="#pipeline">Pipeline</a>
            <a href="#about">About</a>
            {isAuthenticated ? (
              <>
                <Link to="/chat" className="btn btn-primary">Go to Chat</Link>
                <UserMenu />
              </>
            ) : (
              <Link to="/login" className="btn btn-primary">Sign In</Link>
            )}
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero">
        <div className="container hero-content">
          <ScrollReveal direction="fadeUp" delay={0.1}>
            <div className="hero-badges">
              <div className="hero-badge">🤖 Multi-Agent AI System</div>
              <div className="hero-badge genui">✨ Generative UI Powered</div>
            </div>
          </ScrollReveal>
          <ScrollReveal direction="fadeUp" delay={0.2}>
            <h1 className="hero-title">
              Generate <Typewriter words={['Production-Ready', 'Python', 'React', 'Node.js', 'Secure', 'Tested']} typeSpeed={70} deleteSpeed={40} delay={2000} /> Code
              <span className="gradient-text"> in Seconds</span>
            </h1>
          </ScrollReveal>
          <ScrollReveal direction="fadeUp" delay={0.3}>
            <p className="hero-subtitle">
              Leverage the power of 4 specialized AI agents working together to generate,
              validate, test, and secure your code automatically with real-time streaming.
            </p>
          </ScrollReveal>
          <ScrollReveal direction="fadeUp" delay={0.4}>
            <div className="hero-buttons">
              <Link to="/chat" className="btn btn-large btn-gradient">
                Start Generating
                <span className="btn-arrow">→</span>
              </Link>
              {isAuthenticated ? (
                <Link to="/dashboard" className="btn btn-large btn-outline">
                  View Dashboard
                </Link>
              ) : (
                <Link to="/login" className="btn btn-large btn-outline">
                  Sign In for Unlimited
                </Link>
              )}
            </div>
          </ScrollReveal>
          {!isAuthenticated && (
            <ScrollReveal direction="fadeUp" delay={0.5}>
              <p className="hero-guest-note">
                ✨ Try 1 free generation as a guest — no sign-in required!
              </p>
            </ScrollReveal>
          )}
          <StaggerContainer staggerDelay={0.15} threshold={0.3}>
            <div className="hero-stats">
              <StaggerItem direction="scaleIn">
                <div className="stat">
                  <span className="stat-value">4</span>
                  <span className="stat-label">AI Agents</span>
                </div>
              </StaggerItem>
              <StaggerItem direction="scaleIn">
                <div className="stat">
                  <span className="stat-value">∞</span>
                  <span className="stat-label">Possibilities</span>
                </div>
              </StaggerItem>
              <StaggerItem direction="scaleIn">
                <div className="stat">
                  <span className="stat-value">AG-UI</span>
                  <span className="stat-label">Protocol</span>
                </div>
              </StaggerItem>
            </div>
          </StaggerContainer>
        </div>
      </section>

      {/* Engineered Features Section */}
      <FeaturesSection />

      {/* The Agent Pipeline Section */}
      <AgentPipeline />

      {/* About Section */}
      <section id="about" className="about">
        <div className="container">
          <ScrollReveal direction="fadeUp">
            <h2 className="section-title">About This Project</h2>
            <p className="section-subtitle">A Multi-Agent AI System for Code Generation</p>
          </ScrollReveal>
          <div className="about-content">
            <ScrollReveal direction="fadeLeft" delay={0.1}>
              <div className="about-text">
                <p>
                  <strong>Uber Code Generator</strong> is a cutting-edge code generation platform that leverages
                  the power of multiple specialized AI agents working in harmony. Built with real-time streaming
                  technology, it demonstrates the future of AI-powered development tools.
                </p>
                <p>
                  The system uses <strong>4 specialized agents</strong> - Code Generator, Validator, Testing, and Security -
                  each focusing on a specific aspect of code quality. Real-time SSE streaming enables instant feedback
                  as agents process your code.
                </p>
                <div className="tech-stack">
                  <h4>Tech Stack</h4>
                  <div className="tech-tags">
                    <span className="tech-tag">React</span>
                    <span className="tech-tag">FastAPI</span>
                    <span className="tech-tag">MongoDB</span>
                    <span className="tech-tag">Groq LLM</span>
                    <span className="tech-tag">LangGraph</span>
                    <span className="tech-tag">SSE Streaming</span>
                  </div>
                </div>
              </div>
            </ScrollReveal>
            <StaggerContainer staggerDelay={0.15}>
              <div className="about-features">
                <StaggerItem direction="fadeRight">
                  <div className="about-feature">
                    <span className="about-icon">🎯</span>
                    <div>
                      <h4>Purpose</h4>
                      <p>Automate code generation with AI-powered quality assurance</p>
                    </div>
                  </div>
                </StaggerItem>
                <StaggerItem direction="fadeRight">
                  <div className="about-feature">
                    <span className="about-icon">🔄</span>
                    <div>
                      <h4>Workflow</h4>
                      <p>Orchestrated multi-agent pipeline for comprehensive code review</p>
                    </div>
                  </div>
                </StaggerItem>
                <StaggerItem direction="fadeRight">
                  <div className="about-feature">
                    <span className="about-icon">🚀</span>
                    <div>
                      <h4>Speed</h4>
                      <p>Ultra-fast generation powered by Groq's LPU inference</p>
                    </div>
                  </div>
                </StaggerItem>
              </div>
            </StaggerContainer>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta">
        <div className="container cta-content">
          <ScrollReveal direction="scaleIn">
            <h2>Ready to Transform Your Coding Experience?</h2>
            <p>Start generating secure, tested, and validated code today.</p>
            <Link to="/chat" className="btn btn-large btn-white">
              Launch Generator
            </Link>
          </ScrollReveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container footer-content">
          <div className="footer-brand">
            <span className="logo-icon">🚀</span>
            <span>Uber Code Generator</span>
          </div>
          <p className="footer-text">
            A Multi-Agent Code Generation System | Built with LangGraph & React
          </p>
          <p className="footer-copyright">© 2026 Mini Project</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
