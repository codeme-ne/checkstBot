import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import MarkdownViewer from './MarkdownViewer';
import TextViewer from './TextViewer';
import SelectionTooltip from './SelectionTooltip';

// Dynamically import PDFViewer to avoid SSR issues
const PDFViewer = dynamic(() => import('./PDFViewer'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center p-8">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
        <p className="text-gray-500">PDF wird geladen...</p>
      </div>
    </div>
  )
});

interface Document {
  id: string;
  title: string;
  content?: string;
  file?: File;
  type: string;
  uploadDate: string;
}

interface EnhancedDocumentViewerProps {
  document: Document | null;
  onExplain?: (text: string) => void;
  onClose?: () => void;
}

const EnhancedDocumentViewer: React.FC<EnhancedDocumentViewerProps> = ({
  document,
  onExplain,
  onClose
}) => {
  const [selectedText, setSelectedText] = useState('');
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const viewerRef = useRef<HTMLDivElement>(null);

  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      setShowTooltip(false);
      return;
    }

    const text = selection.toString().trim();
    if (text.length > 3) {
      setSelectedText(text);

      // Get selection position
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const viewerRect = viewerRef.current?.getBoundingClientRect();

      if (viewerRect) {
        setTooltipPosition({
          x: rect.left - viewerRect.left + rect.width / 2,
          y: rect.top - viewerRect.top
        });
        setShowTooltip(true);
      }
    } else {
      setShowTooltip(false);
    }
  };

  useEffect(() => {
    const handleMouseUp = () => {
      // Small delay to let selection complete
      setTimeout(handleTextSelection, 10);
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (viewerRef.current && !viewerRef.current.contains(e.target as Node)) {
        setShowTooltip(false);
      }
    };

    window.document.addEventListener('mouseup', handleMouseUp);
    window.document.addEventListener('click', handleClickOutside);

    return () => {
      window.document.removeEventListener('mouseup', handleMouseUp);
      window.document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  const handleExplain = () => {
    if (onExplain && selectedText) {
      onExplain(selectedText);
      setShowTooltip(false);
      // Clear selection
      window.getSelection()?.removeAllRanges();
    }
  };

  if (!document) {
    return (
      <div className="document-viewer-empty">
        <div className="empty-state">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14,2 14,8 20,8"></polyline>
          </svg>
          <h3>Kein Dokument ausgewählt</h3>
          <p>Wählen Sie ein Dokument aus der Liste aus oder laden Sie ein neues hoch.</p>
        </div>
        <style jsx>{`
          .document-viewer-empty {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
            background: #f9fafb;
            border-radius: 12px;
            padding: 2rem;
          }

          .empty-state {
            text-align: center;
            color: #6b7280;
          }

          .empty-state svg {
            margin: 0 auto 1rem;
            opacity: 0.3;
          }

          .empty-state h3 {
            font-size: 1.25rem;
            margin-bottom: 0.5rem;
            color: #374151;
          }

          .empty-state p {
            font-size: 0.95rem;
            color: #9ca3af;
          }
        `}</style>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return '📄';
    if (type.includes('word') || type.includes('docx')) return '📝';
    if (type.includes('text/plain') || type === 'txt') return '📃';
    if (type.includes('markdown') || type === 'md') return '📑';
    return '📋';
  };

  const renderDocumentContent = () => {
    // If we have a file object, render based on its type
    if (document.file) {
      const fileType = document.file.type || document.type;

      if (fileType === 'application/pdf') {
        return <PDFViewer file={document.file} />;
      } else if (fileType === 'text/markdown' || document.file.name.endsWith('.md')) {
        return <MarkdownViewer file={document.file} />;
      } else if (fileType === 'text/plain' || document.file.name.endsWith('.txt')) {
        return <TextViewer file={document.file} />;
      }
    }

    // Fallback to content if no file
    if (document.content && document.content !== '[Content stored in vector database]') {
      // Try to detect content type
      if (document.type === 'markdown' || document.type === 'md') {
        return <MarkdownViewer content={document.content} />;
      }
      return <TextViewer content={document.content} />;
    }

    // Show vector database message
    return (
      <div className="content-info">
        <div className="info-card">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
          <h3>Dokument bereit für Chat</h3>
          <p>
            Der Inhalt dieses Dokuments wurde erfolgreich verarbeitet und in unserer Vektordatenbank gespeichert.
            Sie können jetzt Fragen zu diesem Dokument stellen.
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="enhanced-document-viewer">
      <div className="document-header">
        <div className="document-info">
          <div className="document-icon">{getFileIcon(document.type)}</div>
          <div>
            <h2 className="document-title">{document.title}</h2>
            <div className="document-meta">
              <span>Hochgeladen: {formatDate(document.uploadDate)}</span>
              {document.file && (
                <>
                  <span className="separator">•</span>
                  <span>Größe: {(document.file.size / 1024).toFixed(1)} KB</span>
                </>
              )}
            </div>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="close-button" aria-label="Schließen">
            ✕
          </button>
        )}
      </div>

      <div className="document-body" ref={viewerRef}>
        {renderDocumentContent()}

        {showTooltip && tooltipPosition && (
          <SelectionTooltip
            position={tooltipPosition}
            selectedText={selectedText}
            onExplain={handleExplain}
            onClose={() => setShowTooltip(false)}
          />
        )}
      </div>

      <style jsx>{`
        .enhanced-document-viewer {
          height: 100%;
          display: flex;
          flex-direction: column;
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }

        .document-header {
          padding: 1.5rem;
          border-bottom: 1px solid #e5e7eb;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: linear-gradient(to right, #f9fafb, #ffffff);
        }

        .document-info {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .document-icon {
          font-size: 2.5rem;
          line-height: 1;
        }

        .document-title {
          font-size: 1.25rem;
          font-weight: 600;
          color: #1f2937;
          margin: 0 0 0.25rem 0;
        }

        .document-meta {
          font-size: 0.875rem;
          color: #6b7280;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .separator {
          color: #d1d5db;
        }

        .close-button {
          background: none;
          border: none;
          font-size: 1.5rem;
          color: #6b7280;
          cursor: pointer;
          padding: 0.5rem;
          border-radius: 0.5rem;
          transition: all 0.2s;
        }

        .close-button:hover {
          background: #f3f4f6;
          color: #1f2937;
        }

        .document-body {
          flex: 1;
          overflow-y: auto;
          padding: 1.5rem;
          position: relative;
        }

        .document-body::-webkit-scrollbar {
          width: 8px;
        }

        .document-body::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 4px;
        }

        .document-body::-webkit-scrollbar-thumb {
          background: #c3c3c3;
          border-radius: 4px;
        }

        .document-body::-webkit-scrollbar-thumb:hover {
          background: #999;
        }

        .content-info {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
        }

        .info-card {
          background: #f9fafb;
          border: 2px solid #e5e7eb;
          border-radius: 12px;
          padding: 2rem;
          text-align: center;
          max-width: 500px;
        }

        .info-card svg {
          margin: 0 auto 1rem;
          color: #0066CC;
        }

        .info-card h3 {
          font-size: 1.25rem;
          color: #1f2937;
          margin-bottom: 0.75rem;
        }

        .info-card p {
          color: #6b7280;
          line-height: 1.6;
        }

        @media (max-width: 768px) {
          .document-header {
            padding: 1rem;
          }

          .document-body {
            padding: 1rem;
          }
        }
      `}</style>
    </div>
  );
};

export default EnhancedDocumentViewer;