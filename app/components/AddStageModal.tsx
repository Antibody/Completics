'use client';

import React, { useState, useEffect } from 'react';

interface AddStageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStageAdded: () => void;
  workspaceId: string | null;
}

const AddStageModal: React.FC<AddStageModalProps> = ({
  isOpen,
  onClose,
  onStageAdded,
  workspaceId,
}) => {
  const [title, setTitle] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setError(null);
      setIsLoading(false);
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim()) {
      setError('Stage title cannot be empty.');
      return;
    }
    if (!workspaceId) {
      setError('Workspace ID is missing. Cannot add stage.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/stages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workspaceId: workspaceId,
          title: title.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || `Failed to add stage. Status: ${response.status}`);
      }

      onStageAdded();
      onClose();
    } catch (err) {
      console.error('Failed to add stage:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const modalOverlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  };

  const modalContentStyle: React.CSSProperties = {
    backgroundColor: 'var(--card-bg)',
    color: 'var(--foreground-modal)',
    padding: '24px',
    borderRadius: '8px',
    width: '90%',
    maxWidth: '450px',
    boxShadow: '0 5px 15px rgba(0,0,0,0.3)',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px',
    marginBottom: '16px',
    border: '1px solid var(--input-border)',
    borderRadius: '4px',
    fontSize: '1rem',
    backgroundColor: 'var(--background-input)',
    color: 'var(--foreground-input)',
    boxSizing: 'border-box',
  };

  const buttonStyle: React.CSSProperties = {
    padding: '10px 18px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: 500,
  };
  
  const primaryButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: 'var(--primary-button-background)',
    color: 'var(--primary-button-foreground)',
    marginRight: '10px',
  };

  const secondaryButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: 'var(--button-tertiary-bg)',
    color: 'var(--button-tertiary-text)',
  };


  return (
    <div style={modalOverlayStyle} onClick={onClose}>
      <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginTop: 0, marginBottom: '20px', fontSize: '1.5rem', borderBottom: '1px solid var(--border-color-subtle)', paddingBottom: '10px' }}>
          Add New Stage
        </h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="stage-title" style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
              Stage Title:
            </label>
            <input
              id="stage-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter stage title"
              style={inputStyle}
              disabled={isLoading}
              autoFocus
            />
          </div>

          {error && (
            <p style={{ color: 'var(--text-error)', marginBottom: '16px', fontSize: '0.9rem' }}>
              {error}
            </p>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              style={secondaryButtonStyle}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={primaryButtonStyle}
              disabled={isLoading || !title.trim()}
            >
              {isLoading ? 'Adding...' : 'Add Stage'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddStageModal;
