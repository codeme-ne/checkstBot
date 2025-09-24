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
    return (
      <div className="text-with-lines">
        {showLineNumbers && (
          <div className="line-numbers">
            {lines.map((_, index) => (
              <div key={index} className="line-number">
                {index + 1}
              </div>
            ))}
          </div>
        )}
        <pre className="text-content-pre" style={{ fontSize: `${fontSize}px`, lineHeight }}>
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
          }

          .spinner {
            width: 40px;
            height: 40px;
            border: 4px solid #e5e7eb;
            border-top-color: #0066CC;
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
            color: #6b7280;
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
            color: #ef4444;
            text-align: center;
            padding: 2rem;
          }

          .text-error svg {
            margin-bottom: 1rem;
          }

          .text-error h3 {
            font-size: 1.25rem;
            margin-bottom: 0.5rem;
          }

          .text-error p {
            color: #6b7280;
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
          background: #fafafa;
        }

        .text-controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 1rem;
          background: white;
          border-bottom: 1px solid #e5e7eb;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
          gap: 1rem;
        }

        .controls-left,
        .controls-center,
        .controls-right {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .control-button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border: 1px solid #e5e7eb;
          background: white;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
          color: #4b5563;
        }

        .control-button:hover {
          background: #f3f4f6;
          border-color: #d1d5db;
          color: #1f2937;
        }

        .control-button.active {
          background: #0066CC;
          color: white;
          border-color: #0066CC;
        }

        .control-button.font-size {
          width: auto;
          padding: 0 0.75rem;
          font-size: 0.875rem;
          font-weight: 500;
        }

        .line-height-select {
          padding: 0.5rem 0.75rem;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          background: white;
          font-size: 0.875rem;
          color: #1f2937;
          cursor: pointer;
          transition: all 0.2s;
        }

        .line-height-select:hover {
          border-color: #d1d5db;
          background: #f9fafb;
        }

        .line-height-select:focus {
          outline: none;
          border-color: #0066CC;
          box-shadow: 0 0 0 3px rgba(0, 102, 204, 0.1);
        }

        .text-content-wrapper {
          flex: 1;
          overflow: auto;
          padding: 2rem;
          background: white;
        }

        .text-with-lines {
          display: flex;
          font-family: 'SF Mono', Monaco, 'Courier New', monospace;
        }

        .line-numbers {
          padding-right: 1rem;
          margin-right: 1rem;
          border-right: 1px solid #e5e7eb;
          text-align: right;
          user-select: none;
          color: #9ca3af;
          font-size: 14px;
          line-height: inherit;
        }

        .line-number {
          height: 1.8em;
          display: flex;
          align-items: center;
          justify-content: flex-end;
        }

        :global(.text-content-pre) {
          margin: 0;
          padding: 0;
          white-space: pre-wrap;
          word-wrap: break-word;
          color: #1f2937;
          font-family: 'SF Mono', Monaco, 'Courier New', monospace;
          flex: 1;
        }

        .text-content-wrapper::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        .text-content-wrapper::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 4px;
        }

        .text-content-wrapper::-webkit-scrollbar-thumb {
          background: #c3c3c3;
          border-radius: 4px;
        }

        .text-content-wrapper::-webkit-scrollbar-thumb:hover {
          background: #999;
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
        }
      `}</style>
    </div>
  );
};

export default TextViewer;