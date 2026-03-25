// Usage Limit Modal - Shows when guest users reach their free limit
import React from 'react';
import GoogleSignInButton from './GoogleSignInButton';
import './UsageLimitModal.css';

const UsageLimitModal = ({ isOpen, onClose, onSignInSuccess }) => {
  if (!isOpen) return null;

  const handleSignInSuccess = (userData) => {
    if (onSignInSuccess) {
      onSignInSuccess(userData);
    }
    onClose();
  };

  return (
    <div className="usage-limit-overlay" onClick={onClose}>
      <div className="usage-limit-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        
        <div className="modal-icon">🚀</div>
        
        <h2>You've Used Your Free Prompt!</h2>
        
        <p className="modal-description">
          Sign in with Google to continue generating unlimited code with our 
          AI-powered multi-agent system.
        </p>
        
        <div className="modal-benefits">
          <div className="benefit-item">
            <span className="benefit-icon">✨</span>
            <span>Unlimited code generation</span>
          </div>
          <div className="benefit-item">
            <span className="benefit-icon">💾</span>
            <span>Save your chat history</span>
          </div>
          <div className="benefit-item">
            <span className="benefit-icon">🔄</span>
            <span>Access from any device</span>
          </div>
        </div>
        
        <div className="modal-signin">
          <GoogleSignInButton onSuccess={handleSignInSuccess} />
        </div>
        
        <p className="modal-footer">
          Free forever • No credit card required
        </p>
      </div>
    </div>
  );
};

export default UsageLimitModal;
