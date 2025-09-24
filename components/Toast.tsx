import React, { useEffect, useState } from 'react';

export interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
  onClose?: () => void;
}

const Toast: React.FC<ToastProps> = ({
  message,
  type = 'info',
  duration = 3000,
  onClose
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLeaving(true);
      setTimeout(() => {
        setIsVisible(false);
        onClose?.();
      }, 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  if (!isVisible) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        );
      case 'error':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        );
      case 'warning':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        );
      default:
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        );
    }
  };

  return (
    <>
      <div className={`toast toast-${type} ${isLeaving ? 'leaving' : ''}`}>
        <div className="toast-icon">
          {getIcon()}
        </div>
        <div className="toast-message">{message}</div>
        <button
          className="toast-close"
          onClick={() => {
            setIsLeaving(true);
            setTimeout(() => {
              setIsVisible(false);
              onClose?.();
            }, 300);
          }}
          aria-label="Schließen"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <style jsx>{`
        .toast {
          position: fixed;
          bottom: 2rem;
          right: 2rem;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem 1.25rem;
          background: white;
          border-radius: 12px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
          max-width: 400px;
          z-index: 10000;
          animation: slideIn 0.3s ease;
        }

        .toast.leaving {
          animation: slideOut 0.3s ease;
        }

        @keyframes slideIn {
          from {
            transform: translateX(120%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        @keyframes slideOut {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(120%);
            opacity: 0;
          }
        }

        .toast-icon {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 8px;
        }

        .toast-success .toast-icon {
          background: #d4f4dd;
          color: #22c55e;
        }

        .toast-error .toast-icon {
          background: #fee;
          color: #ef4444;
        }

        .toast-warning .toast-icon {
          background: #fef3c7;
          color: #f59e0b;
        }

        .toast-info .toast-icon {
          background: #e0e7ff;
          color: #667eea;
        }

        .toast-message {
          flex: 1;
          font-size: 0.875rem;
          color: #1a1a1a;
          line-height: 1.5;
        }

        .toast-close {
          flex-shrink: 0;
          background: none;
          border: none;
          color: #666;
          cursor: pointer;
          padding: 0.25rem;
          border-radius: 4px;
          transition: all 0.2s;
        }

        .toast-close:hover {
          background: #f5f5f5;
          color: #1a1a1a;
        }

        @media (max-width: 640px) {
          .toast {
            left: 1rem;
            right: 1rem;
            bottom: 1rem;
            max-width: none;
          }
        }
      `}</style>
    </>
  );
};

// Toast Container to manage multiple toasts
export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<Array<ToastProps & { id: string }>>([]);

  useEffect(() => {
    const handleToast = (event: CustomEvent<ToastProps>) => {
      const id = Date.now().toString();
      setToasts(prev => [...prev, { ...event.detail, id }]);
    };

    window.addEventListener('showToast' as any, handleToast);
    return () => window.removeEventListener('showToast' as any, handleToast);
  }, []);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <>
      {toasts.map((toast, index) => (
        <div key={toast.id} style={{
          position: 'fixed',
          bottom: `${2 + index * 5}rem`,
          right: '2rem',
          zIndex: 10000 + index
        }}>
          <Toast
            {...toast}
            onClose={() => removeToast(toast.id)}
          />
        </div>
      ))}
    </>
  );
};

// Helper function to show toast
export const showToast = (message: string, type: ToastProps['type'] = 'info', duration = 3000) => {
  const event = new CustomEvent('showToast', {
    detail: { message, type, duration }
  });
  window.dispatchEvent(event);
};

export default Toast;