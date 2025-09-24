import React, { useEffect } from 'react';

interface SelectionTooltipProps {
  position: { x: number; y: number };
  selectedText: string;
  onExplain: () => void;
  onClose: () => void;
}

const SelectionTooltip: React.FC<SelectionTooltipProps> = ({
  position,
  selectedText,
  onExplain,
  onClose,
}) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(selectedText);
    } catch (error) {
      console.error('Failed to copy selected text', error);
    }
  };

  return (
    <div
      className="selection-tooltip"
      style={{
        top: Math.max(position.y - 56, 8),
        left: position.x,
      }}
      role="dialog"
      aria-live="polite"
    >
      <div className="selection-tooltip__content">
        <span className="selection-tooltip__label">Markierter Text</span>
        <div className="selection-tooltip__actions">
          <button className="selection-tooltip__button" onClick={onExplain}>
            Erklären
          </button>
          <button className="selection-tooltip__button" onClick={handleCopy}>
            Kopieren
          </button>
          <button className="selection-tooltip__close" onClick={onClose} aria-label="Schließen">
            ×
          </button>
        </div>
      </div>

      <style jsx>{`
        .selection-tooltip {
          position: absolute;
          transform: translate(-50%, -100%);
          padding: 0.5rem 0.75rem;
          background: #111827;
          color: #f9fafb;
          border-radius: 9999px;
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.2);
          display: flex;
          align-items: center;
          gap: 0.75rem;
          z-index: 20;
          pointer-events: auto;
        }

        .selection-tooltip__content {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .selection-tooltip__label {
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          opacity: 0.8;
        }

        .selection-tooltip__actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .selection-tooltip__button {
          background: rgba(255, 255, 255, 0.12);
          color: inherit;
          border: none;
          border-radius: 9999px;
          padding: 0.35rem 0.75rem;
          font-size: 0.75rem;
          cursor: pointer;
          transition: background 0.2s ease;
        }

        .selection-tooltip__button:hover {
          background: rgba(255, 255, 255, 0.22);
        }

        .selection-tooltip__close {
          background: transparent;
          border: none;
          color: inherit;
          font-size: 1rem;
          line-height: 1;
          cursor: pointer;
          padding: 0.25rem;
        }

        @media (max-width: 768px) {
          .selection-tooltip {
            transform: translate(-50%, -110%);
            padding: 0.4rem 0.6rem;
          }

          .selection-tooltip__actions {
            gap: 0.35rem;
          }
        }
      `}</style>
    </div>
  );
};

export default SelectionTooltip;
