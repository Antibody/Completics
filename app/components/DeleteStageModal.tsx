// components/DeleteStageModal.tsx
'use client';

import React from 'react';

interface DeleteStageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmDelete: (stageId: string) => void;
  stageTitle: string;
  stageId: string | null;
  isDeleting: boolean;
  errorMessage: string | null;
}

const DeleteStageModal: React.FC<DeleteStageModalProps> = ({
  isOpen,
  onClose,
  onConfirmDelete,
  stageTitle,
  stageId,
  isDeleting,
  errorMessage,
}) => {
  if (!isOpen) {
    return null;
  }

  const modalOverlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10, 10, 20, 0.75)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
    backdropFilter: 'blur(3px)',
  };

  const modalContentStyle: React.CSSProperties = {
    backgroundColor: 'var(--background-modal)',
    padding: '32px 40px',
    borderRadius: '12px',
    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.3)',
    color: 'var(--foreground-modal)',
    width: '90%',
    maxWidth: '450px',
    display: 'flex',
    flexDirection: 'column',
  };

  const modalHeaderStyle: React.CSSProperties = {
    marginBottom: '12px',
    paddingBottom: '12px',
    borderBottom: '1px solid var(--border-color-subtle)',
  };

  const buttonStyle: React.CSSProperties = {
    padding: '10px 20px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '1rem',
    marginRight: '10px',
  };

  const secondaryButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: 'var(--secondary-button-background)',
    color: 'var(--secondary-button-foreground)',
  };

  const dangerButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: 'var(--button-danger-bg)',
    color: 'var(--button-danger-text)',
  };

  return (
    <div style={modalOverlayStyle} onClick={onClose}>
      <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
        <div style={modalHeaderStyle}>
          <h2 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 600 }}>
            Delete Stage
          </h2>
        </div>
        <p style={{ marginBottom: '20px', lineHeight: '1.5' }}>
          Are you sure you want to delete the stage <strong>{stageTitle}</strong>?
          All tasks within this stage will also be permanently deleted. This action cannot be undone.
        </p>

        {errorMessage && (
          <p style={{ color: 'var(--text-error)', marginBottom: '16px', fontSize: '0.9rem' }}>
            {errorMessage}
          </p>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            type="button"
            onClick={onClose}
            style={secondaryButtonStyle}
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => stageId && onConfirmDelete(stageId)}
            style={dangerButtonStyle}
            disabled={isDeleting || !stageId}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteStageModal;
