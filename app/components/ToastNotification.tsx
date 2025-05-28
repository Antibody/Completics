// app/components/ToastNotification.tsx
'use client';

import React, { useEffect, useState } from 'react';

interface ToastNotificationProps {
  message: string;
  type: 'success' | 'error' | 'info';
  duration?: number;
  onClose: () => void;
  actionText?: string; // Added for undo button text
  onActionClick?: () => void; // Added for undo button action
}

const ToastNotification: React.FC<ToastNotificationProps> = ({
  message,
  type,
  duration = 5000,
  onClose,
  actionText,
  onActionClick,
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      onClose(); // Notify parent to remove from DOM or manage state
    }, duration);

    return () => {
      clearTimeout(timer);
    };
  }, [duration, onClose]);

  if (!isVisible) {
    return null;
  }

  const baseStyle: React.CSSProperties = {
    position: 'fixed',
    top: '20px',
    right: '20px',
    padding: '12px 20px',
    borderRadius: '6px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    color: 'white',
    zIndex: 2000,
    fontSize: '0.9rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between', // This will be adjusted if action button is present
    minWidth: '250px',
    maxWidth: '350px',
  };

  const typeStyles = {
    success: { backgroundColor: 'var(--toast-success-bg, #4CAF50)' },
    error: { backgroundColor: 'var(--toast-error-bg, #F44336)' },
    info: { backgroundColor: 'var(--toast-info-bg, #2196F3)' },
  };

  const closeButtonStyle: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    color: 'white',
    fontSize: '1.2rem',
    lineHeight: '1',
    cursor: 'pointer',
    marginLeft: '10px', // Adjusted margin
    padding: '0',
  };

  const actionButtonStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.2)',
    border: '1px solid rgba(255,255,255,0.5)',
    color: 'white',
    padding: '4px 8px',
    borderRadius: '4px',
    cursor: 'pointer',
    marginLeft: '10px',
    fontSize: '0.8rem',
    fontWeight: 'bold',
  };

  const contentStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    flexGrow: 1, // Allow message to take available space
  };

  return (
    <div style={{ ...baseStyle, ...typeStyles[type], justifyContent: 'flex-start' /* Adjust for more items */ }}>
      <div style={contentStyle}>
        <span>{message}</span>
      </div>
      {actionText && onActionClick && (
        <button
          onClick={() => {
            onActionClick();
            setIsVisible(false); // Optionally close toast on action
            onClose(); // Notify parent
          }}
          style={actionButtonStyle}
        >
          {actionText}
        </button>
      )}
      <button
        onClick={() => { setIsVisible(false); onClose(); }}
        style={closeButtonStyle}
        aria-label="Close notification"
      >
        &times;
      </button>
    </div>
  );
};

export default ToastNotification;
