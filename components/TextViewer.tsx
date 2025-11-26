import React, { useState, useEffect } from 'react';

interface TextViewerProps {
  file?: File;
  content?: string;
}

const TextViewer: React.FC<TextViewerProps> = ({ file, content }) => {
  const [textContent, setTextContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(!!file);
  const [error, setError] = useState<string | null>(null);
  const [fontSize, setFontSize] = useState(16);
  const [lineHeight, setLineHeight] = useState(1.8);
  const [showLineNumbers, setShowLineNumbers] = useState(false);

  useEffect(() => {
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setTextContent(text);
        setIsLoading(false);
      };
      reader.onerror = () => {
        setError('Fehler beim Lesen der Datei');
        setIsLoading(false);
      };
      reader.readAsText(file);
    } else if (content) {
      setTextContent(content);
      setIsLoading(false);
    }
  }, [file, content]);

  const increaseFontSize = () => {
    setFontSize(prev => Math.min(prev + 2, 24));
  };

  const decreaseFontSize = () => {
    setFontSize(prev => Math.max(prev - 2, 12));
  };

  const resetFontSize = () => {
    setFontSize(16);
  };

  const toggleLineNumbers = () => {
    setShowLineNumbers(!showLineNumbers);
  };

  const renderTextWithLineNumbers = () => {
    const lines = textContent.split('\n');
    const lineHeightPx = fontSize * lineHeight;

    return (
      <div className="text-with-lines">
        {showLineNumbers && (
          <div
            className="line-numbers"
            style={{
              fontSize: `${fontSize}px`,
              lineHeight: lineHeight
            }}
          >
            {lines.map((_, index) => (
              <div
                key={index}
                className="line-number"
                style={{ height: `${lineHeightPx}px` }}
              >
                {index + 1}
              </div>
            ))}
          </div>
        )}
        <pre
          className="text-content-pre"
          style={{ fontSize: `${fontSize}px`, lineHeight }}
        >
          {textContent}
        </pre>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="text-loading">
        <div className="spinner"></div>
        <p>Dokument wird geladen...</p>
        <style jsx>{`
          .text-loading {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            padding: 2rem;
            background: #0d0d0f;
          }

          .spinner {
            width: 40px;
            height: 40px;
            border: 3px solid rgba(50, 184, 198, 0.2);
            border-top-color: #32B8C6;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-bottom: 1rem;
          }

          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }

          .text-loading p {
            color: #71717a;
            font-size: 0.875rem;
          }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-error">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <h3>Fehler beim Laden</h3>
        <p>{error}</p>
        <style jsx>{`
          .text-error {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: #ff5459;
            text-align: center;
            padding: 2rem;
            background: #0d0d0f;
          }

          .text-error svg {
            margin-bottom: 1rem;
          }

          .text-error h3 {
            font-size: 1.125rem;
            margin-bottom: 0.5rem;
          }

          .text-error p {
            color: #71717a;
            font-size: 0.875rem;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="text-viewer">
      <div className="text-controls">
        <div className="controls-left">
          <button
            onClick={toggleLineNumbers}
            className={`control-button ${showLineNumbers ? 'active' : ''}`}
            title="Zeilennummern anzeigen/verbergen"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="10" y1="6" x2="21" y2="6"></line>
              <line x1="10" y1="12" x2="21" y2="12"></line>
              <line x1="10" y1="18" x2="21" y2="18"></line>
              <path d="M4 6h1v1H4zM4 12h1v1H4zM4 18h1v1H4z"></path>
            </svg>
          </button>
        </div>

        <div className="controls-center">
          <button
            onClick={decreaseFontSize}
            className="control-button"
            title="Schrift verkleinern"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="8" y1="11" x2="14" y2="11"></line>
            </svg>
          </button>

          <button
            onClick={resetFontSize}
            className="control-button font-size"
            title="Schriftgröße zurücksetzen"
          >
            {fontSize}px
          </button>

          <button
            onClick={increaseFontSize}
            className="control-button"
            title="Schrift vergrößern"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="11" y1="8" x2="11" y2="14"></line>
              <line x1="8" y1="11" x2="14" y2="11"></line>
            </svg>
          </button>
        </div>

        <div className="controls-right">
          <select
            value={lineHeight}
            onChange={(e) => setLineHeight(parseFloat(e.target.value))}
            className="line-height-select"
            title="Zeilenhöhe"
          >
            <option value="1.4">Kompakt</option>
            <option value="1.6">Normal</option>
            <option value="1.8">Komfortabel</option>
            <option value="2.0">Weit</option>
          </select>
        </div>
      </div>

      <div className="text-content-wrapper">
        {renderTextWithLineNumbers()}
      </div>

      <style jsx>{`
        .text-viewer {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #0d0d0f;
        }

        .text-controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.625rem 1rem;
          background: #141416;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          gap: 1rem;
        }

        .controls-left,
        .controls-center,
        .controls-right {
          display: flex;
          align-items: center;
          gap: 0.375rem;
        }

        .control-button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: transparent;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
          color: #71717a;
        }

        .control-button:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(255, 255, 255, 0.15);
          color: #a1a1aa;
        }

        .control-button.active {
          background: rgba(50, 184, 198, 0.15);
          color: #32B8C6;
          border-color: rgba(50, 184, 198, 0.3);
        }

        .control-button.font-size {
          width: auto;
          padding: 0 0.625rem;
          font-size: 0.75rem;
          font-weight: 500;
        }

        .line-height-select {
          padding: 0.375rem 0.625rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          background: #1a1a1c;
          font-size: 0.75rem;
          color: #a1a1aa;
          cursor: pointer;
          transition: all 0.2s;
        }

        .line-height-select:hover {
          border-color: rgba(255, 255, 255, 0.15);
          background: #1e1e22;
        }

        .line-height-select:focus {
          outline: none;
          border-color: rgba(50, 184, 198, 0.5);
          box-shadow: 0 0 0 2px rgba(50, 184, 198, 0.1);
        }

        .text-content-wrapper {
          flex: 1;
          overflow: auto;
          padding: 1.5rem 2rem;
          background: #0d0d0f;
          scroll-behavior: smooth;
        }

        :global(.text-with-lines) {
          display: flex !important;
          flex-direction: row !important;
          flex-wrap: nowrap !important;
          font-family: 'SF Mono', Monaco, 'Courier New', monospace;
          align-items: flex-start;
          width: 100%;
        }

        :global(.line-numbers) {
          padding-right: 1rem;
          margin-right: 0.5rem;
          border-right: 1px solid rgba(255, 255, 255, 0.12);
          text-align: right;
          user-select: none;
          color: #52525b;
          font-size: 13px;
          flex-shrink: 0;
          min-width: 3rem;
          position: sticky;
          left: 0;
          background: #0d0d0f;
        }

        :global(.line-number) {
          display: block;
          padding: 0 0.25rem;
        }

        :global(.text-content-pre) {
          margin: 0;
          padding: 0;
          white-space: pre-wrap;
          word-wrap: break-word;
          color: #f0f0f2;
          font-family: 'SF Mono', Monaco, 'Courier New', monospace;
          flex: 1;
          position: relative;
          z-index: 2;
          letter-spacing: 0.3px;
          -webkit-font-smoothing: antialiased;
          text-rendering: optimizeLegibility;
        }

        .text-content-wrapper::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        .text-content-wrapper::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
        }

        .text-content-wrapper::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.12);
          border-radius: 4px;
          min-height: 40px;
        }

        .text-content-wrapper::-webkit-scrollbar-thumb:hover {
          background: rgba(50, 184, 198, 0.4);
        }

        :global(.text-content-pre)::selection {
          background-color: rgba(50, 184, 198, 0.3);
          color: inherit;
        }

        @media (max-width: 768px) {
          .text-controls {
            flex-wrap: wrap;
            padding: 0.5rem;
          }

          .controls-left,
          .controls-center,
          .controls-right {
            flex: 1;
            justify-content: center;
          }

          .text-content-wrapper {
            padding: 1rem;
          }

          :global(.line-numbers) {
            display: none;
          }
        }

        @media (min-width: 1600px) {
          .text-content-wrapper {
            padding: 2rem 2.5rem;
          }
        }

        @media (prefers-contrast: high) {
          :global(.text-content-pre) {
            color: #ffffff;
            letter-spacing: 0.5px;
          }

          :global(.line-numbers) {
            color: #999999;
            border-right-color: #555555;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .text-content-wrapper {
            scroll-behavior: auto;
          }
        }
      `}</style>
    </div>
  );
};

export default TextViewer;