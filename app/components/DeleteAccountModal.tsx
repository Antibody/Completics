'use client';

import React, { useState } from 'react'; // Kept the one with useState

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmDelete: (password: string) => Promise<void>; // Now accepts password
  isDeleting: boolean; 
  errorMessage?: string | null; // Optional error message from parent
}

const DeleteAccountModal: React.FC<DeleteAccountModalProps> = ({
  isOpen,
  onClose,
  onConfirmDelete,
  isDeleting,
  errorMessage,
}) => {
  const [password, setPassword] = useState('');

  if (!isOpen) {
    return null;
  }

  const handleConfirm = () => {
    if (!password.trim()) {
      // Optionally set a local error message for empty password, or let parent handle
      alert("Password is required to confirm deletion."); // Simple alert for now
      return;
    }
    onConfirmDelete(password);
  };

  const modalOverlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10, 10, 20, 0.85)', // Darker overlay for serious action
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1050, // Higher than header menu
    backdropFilter: 'blur(4px)',
  };

  const modalContentStyle: React.CSSProperties = {
    backgroundColor: 'var(--background-modal)',
    padding: '32px 40px',
    borderRadius: '12px',
    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)',
    color: 'var(--foreground-modal)',
    width: '90%',
    maxWidth: '500px',
    textAlign: 'center', // Center text content
  };

  const modalHeaderStyle: React.CSSProperties = {
    marginBottom: '16px',
    paddingBottom: '12px',
    borderBottom: '1px solid var(--border-color-subtle)',
  };

  const titleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: '1.6rem',
    fontWeight: 600,
    color: 'var(--text-error)', // Red title for warning
  };

  const subTextStyle: React.CSSProperties = { // For "Please enter your password"
    marginTop: '20px',
    marginBottom: '8px',
    color: 'var(--foreground-secondary)',
    fontSize: '0.9rem',
    textAlign: 'left',
  };

  const passwordInputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    marginBottom: '12px', // Space before error or buttons
    border: '1px solid var(--input-border)',
    borderRadius: '4px',
    backgroundColor: 'var(--input-bg)',
    color: 'var(--input-text)',
    boxSizing: 'border-box',
    fontSize: '1rem',
  };
  
  const errorTextStyle: React.CSSProperties = {
    color: 'var(--text-error)',
    fontSize: '0.85rem',
    marginBottom: '16px',
    minHeight: '1.2em', // Reserve space even if no error
  };

  const warningTextStyle: React.CSSProperties = {
    marginTop: '8px',
    marginBottom: '28px',
    color: 'var(--foreground-secondary)',
    fontSize: '0.95rem',
    lineHeight: 1.6,
  };

  const buttonBaseStyle: React.CSSProperties = {
    padding: '10px 20px',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: 500,
    transition: 'opacity 0.2s ease, background-color 0.2s ease',
  };

  const cancelButtonStyle: React.CSSProperties = {
    ...buttonBaseStyle,
    backgroundColor: 'var(--secondary-button-background)',
    color: 'var(--secondary-button-foreground)',
    marginRight: '12px',
  };

  const deleteButtonStyle: React.CSSProperties = {
    ...buttonBaseStyle,
    backgroundColor: '#DE350B', // Hardcoded strong red (from light theme's --text-error)
    color: '#FFFFFF', // White text for good contrast
  };

  return (
    <div style={modalOverlayStyle} onClick={onClose}>
      <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
        <div style={modalHeaderStyle}>
          <h2 style={titleStyle}>Delete Your Account?</h2>
        </div>
        <p style={warningTextStyle}>
          Are you sure you want to delete your account? This action is permanent
          and will erase all your boards, tasks, projects, and versions.
          <br />
          <strong>This cannot be undone.</strong>
        </p>

        <label htmlFor="confirmPasswordDelete" style={subTextStyle}>
          To confirm, please enter your password:
        </label>
        <input
          id="confirmPasswordDelete"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={passwordInputStyle}
          disabled={isDeleting}
          placeholder="Your password"
        />

        <div style={errorTextStyle}>
          {errorMessage && <p style={{margin: 0}}>{errorMessage}</p>}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
          <button
            onClick={onClose}
            style={cancelButtonStyle}
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            style={deleteButtonStyle}
            disabled={isDeleting || !password.trim()}
          >
            {isDeleting ? 'Deleting...' : 'Confirm Delete Account'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteAccountModal;
