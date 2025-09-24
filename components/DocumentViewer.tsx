import React from 'react';

interface Document {
  id: string;
  title: string;
  content?: string;
  type: string;
  uploadDate: string;
}

interface DocumentViewerProps {
  document: Document | null;
  onClose?: () => void;
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({ document, onClose }) => {
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
    switch (type) {
      case 'application/pdf':
      case 'pdf':
        return '📄';
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      case 'docx':
        return '📝';
      case 'text/plain':
      case 'txt':
        return '📃';
      case 'text/markdown':
      case 'md':
      case 'markdown':
        return '📑';
      default:
        return '📋';
    }
  };

  return (
    <div className="document-viewer">
      <div className="document-header">
        <div className="document-info">
          <div className="document-icon">{getFileIcon(document.type)}</div>
          <div>
            <h2 className="document-title">{document.title}</h2>
            <div className="document-meta">
              <span>Hochgeladen: {formatDate(document.uploadDate)}</span>
              <span className="separator">•</span>
              <span>ID: {document.id}</span>
            </div>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="close-button" aria-label="Schließen">
            ✕
          </button>
        )}
      </div>

      <div className="document-body">
        {document.content && document.content !== '[Content stored in vector database]' ? (
          <div className="document-content">
            <pre>{document.content}</pre>
          </div>
        ) : (
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

              <div className="sample-questions">
                <h4>Beispielfragen:</h4>
                <ul>
                  <li>"Was sind die Hauptthemen in diesem Dokument?"</li>
                  <li>"Fasse die wichtigsten Punkte zusammen"</li>
                  <li>"Erkläre mir [spezifisches Thema] aus dem Dokument"</li>
                </ul>
              </div>
            </div>

            <div className="processing-info">
              <h4>✅ Verarbeitungsstatus</h4>
              <ul className="status-list">
                <li className="complete">Dokument hochgeladen</li>
                <li className="complete">Text extrahiert</li>
                <li className="complete">In Abschnitte unterteilt</li>
                <li className="complete">Embeddings generiert</li>
                <li className="complete">In Vektordatenbank gespeichert</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .document-viewer {
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

        .document-content pre {
          font-family: 'SF Mono', Monaco, monospace;
          font-size: 0.9rem;
          line-height: 1.6;
          white-space: pre-wrap;
          word-wrap: break-word;
          color: #374151;
        }

        .content-info {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        .info-card {
          background: #f9fafb;
          border: 2px solid #e5e7eb;
          border-radius: 12px;
          padding: 2rem;
          text-align: center;
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
          margin-bottom: 1.5rem;
        }

        .sample-questions {
          text-align: left;
          background: white;
          border-radius: 8px;
          padding: 1rem;
          margin-top: 1rem;
        }

        .sample-questions h4 {
          font-size: 0.95rem;
          color: #374151;
          margin-bottom: 0.75rem;
        }

        .sample-questions ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .sample-questions li {
          padding: 0.5rem 0;
          color: #6b7280;
          font-size: 0.9rem;
          border-left: 3px solid #0066CC;
          padding-left: 1rem;
          margin-bottom: 0.5rem;
          background: #f0f9ff;
          border-radius: 0 4px 4px 0;
        }

        .processing-info {
          background: #f0fdf4;
          border: 1px solid #86efac;
          border-radius: 8px;
          padding: 1.5rem;
        }

        .processing-info h4 {
          color: #16a34a;
          margin-bottom: 1rem;
          font-size: 1rem;
        }

        .status-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .status-list li {
          padding: 0.5rem 0;
          color: #16a34a;
          font-size: 0.9rem;
          display: flex;
          align-items: center;
        }

        .status-list li::before {
          content: "✓";
          margin-right: 0.75rem;
          font-weight: bold;
          font-size: 1.1rem;
        }

        @media (max-width: 768px) {
          .document-header {
            padding: 1rem;
          }

          .document-body {
            padding: 1rem;
          }

          .info-card {
            padding: 1.5rem;
          }
        }
      `}</style>
    </div>
  );
};

export default DocumentViewer;