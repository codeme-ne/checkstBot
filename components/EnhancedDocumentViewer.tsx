import React, { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CalendarClock, Download, FileText, X } from 'lucide-react';
import MarkdownViewer from './MarkdownViewer';
import SelectionTooltip from './SelectionTooltip';
import TextViewer from './TextViewer';
import type { PDFViewerState } from './PDFViewer';

const PDFViewer = dynamic(() => import('./PDFViewer'), {
  ssr: false,
  loading: () => (
    <div className="viewer-loading">
      <div className="viewer-loading__spinner" />
      <p>PDF wird geladen...</p>
    </div>
  ),
});

interface Document {
  id: string;
  title: string;
  content?: string;
  file?: File;
  type: string;
  uploadDate: string;
}

interface SummaryState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  markdown?: string;
  error?: string;
  generatedAt?: string;
}

interface EnhancedDocumentViewerProps {
  document: Document | null;
  viewerMode?: 'document' | 'summary';
  summaryState?: SummaryState;
  onExplain?: (text: string) => void;
  onDownload?: () => void;
  onCloseDocument?: () => void;
  pdfViewerState?: PDFViewerState;
  onPDFViewerStateChange?: (nextState: Partial<PDFViewerState>) => void;
  downloadDisabled?: boolean;
}

const EnhancedDocumentViewer: React.FC<EnhancedDocumentViewerProps> = ({
  document,
  viewerMode = 'document',
  summaryState = { status: 'idle' },
  onExplain,
  onDownload,
  onCloseDocument,
  pdfViewerState = { pageNumber: 1, scale: 1, searchQuery: '', activeMatchIndex: -1 },
  onPDFViewerStateChange,
  downloadDisabled = false,
}) => {
  const [selectedText, setSelectedText] = useState('');
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const viewerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (viewerMode !== 'document') {
      setShowTooltip(false);
      return;
    }

    const handleTextSelection = () => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        setShowTooltip(false);
        return;
      }

      const text = selection.toString().trim();
      if (text.length <= 3) {
        setShowTooltip(false);
        return;
      }

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const viewerRect = viewerRef.current?.getBoundingClientRect();
      if (!viewerRect) {
        setShowTooltip(false);
        return;
      }

      setSelectedText(text);
      setTooltipPosition({
        x: rect.left - viewerRect.left + rect.width / 2,
        y: rect.top - viewerRect.top,
      });
      setShowTooltip(true);
    };

    const handleMouseUp = () => {
      window.setTimeout(handleTextSelection, 10);
    };

    const handleClickOutside = (event: MouseEvent) => {
      if (viewerRef.current && !viewerRef.current.contains(event.target as Node)) {
        setShowTooltip(false);
      }
    };

    window.document.addEventListener('mouseup', handleMouseUp);
    window.document.addEventListener('click', handleClickOutside);

    return () => {
      window.document.removeEventListener('mouseup', handleMouseUp);
      window.document.removeEventListener('click', handleClickOutside);
    };
  }, [viewerMode]);

  const documentMeta = useMemo(() => {
    if (!document) {
      return null;
    }

    const uploadLabel = new Date(document.uploadDate).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    return {
      uploadLabel,
      sizeLabel: document.file ? `${(document.file.size / 1024).toFixed(1)} KB` : null,
    };
  }, [document]);

  const handleExplain = () => {
    if (!onExplain || !selectedText) {
      return;
    }

    onExplain(selectedText);
    setShowTooltip(false);
    window.getSelection()?.removeAllRanges();
  };

  if (!document) {
    return (
      <div className="document-viewer-empty">
        <div className="document-viewer-empty__card">
          <FileText size={42} />
          <h3>Kein Dokument ausgewaehlt</h3>
          <p>Waehle ein Dokument aus den Tabs aus oder lade ein neues Dokument hoch.</p>
        </div>

        <style jsx>{`
          .document-viewer-empty {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
          }

          .document-viewer-empty__card {
            text-align: center;
            color: #60594d;
          }

          .document-viewer-empty__card h3 {
            margin: 16px 0 8px;
            color: #29251f;
          }

          .document-viewer-empty__card p {
            margin: 0;
          }
        `}</style>
      </div>
    );
  }

  const renderDocumentContent = () => {
    if (document.file) {
      const fileType = document.file.type || document.type;

      if (fileType === 'application/pdf') {
        return (
          <PDFViewer
            file={document.file}
            state={pdfViewerState}
            onStateChange={onPDFViewerStateChange}
            onDownload={onDownload}
            onCloseDocument={onCloseDocument}
            downloadDisabled={downloadDisabled}
          />
        );
      }

      if (fileType === 'text/markdown' || document.file.name.endsWith('.md')) {
        return <MarkdownViewer file={document.file} />;
      }

      if (fileType === 'text/plain' || document.file.name.endsWith('.txt')) {
        return <TextViewer file={document.file} />;
      }
    }

    if (document.content && document.content !== '[Content stored in vector database]') {
      if (document.type === 'markdown' || document.type === 'md' || document.title.endsWith('.md')) {
        return <MarkdownViewer content={document.content} />;
      }

      return <TextViewer content={document.content} />;
    }

    return (
      <div className="document-fallback">
        <FileText size={40} />
        <h3>Dokument bereit fuer den Assistenten</h3>
        <p>
          Der Volltext ist in dieser Sitzung nicht lokal verfuegbar. Der Assistent kann
          dennoch mit den gespeicherten Dokumentdaten arbeiten.
        </p>
      </div>
    );
  };

  const renderSummary = () => {
    if (summaryState.status === 'loading' || summaryState.status === 'idle') {
      return (
        <div className="summary-state">
          <div className="viewer-loading__spinner" />
          <h3>Original Summary wird erstellt</h3>
          <p>Das komplette Dokument wird in Abschnitte verdichtet und als Reader-Ansicht aufgebaut.</p>
        </div>
      );
    }

    if (summaryState.status === 'error') {
      return (
        <div className="summary-state summary-state--error">
          <h3>Zusammenfassung nicht verfuegbar</h3>
          <p>{summaryState.error}</p>
        </div>
      );
    }

    return (
      <div className="summary-reader" data-testid="document-summary">
        <div className="summary-divider">
          <span>Original Summary</span>
        </div>

        <div className="summary-reader__body">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h2({ children }) {
                return <h2 className="summary-markdown__heading">{children}</h2>;
              },
              ul({ children }) {
                return <ul className="summary-markdown__list">{children}</ul>;
              },
              li({ children }) {
                return <li className="summary-markdown__item">{children}</li>;
              },
              p({ children }) {
                return <p className="summary-markdown__paragraph">{children}</p>;
              },
            }}
          >
            {summaryState.markdown || ''}
          </ReactMarkdown>
        </div>

        {summaryState.generatedAt && (
          <p className="summary-reader__meta">
            Aktualisiert am {new Date(summaryState.generatedAt).toLocaleString('de-DE')}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="enhanced-document-viewer">
      {viewerMode === 'document' ? (
        <>
          <div className="document-header">
            <div className="document-header__primary">
              <div className="document-header__icon">
                <FileText size={20} />
              </div>

              <div className="document-header__copy">
                <h2>{document.title}</h2>
                <div className="document-header__meta">
                  <span>
                    <CalendarClock size={13} />
                    <span>Hochgeladen: {documentMeta?.uploadLabel}</span>
                  </span>
                  {documentMeta?.sizeLabel && <span>Groesse: {documentMeta.sizeLabel}</span>}
                </div>
              </div>
            </div>

            <div className="document-header__actions">
              {onDownload && (
                <button
                  type="button"
                  className="document-header__button"
                  onClick={onDownload}
                  disabled={downloadDisabled}
                  aria-label="Dokument herunterladen"
                >
                  <Download size={16} />
                </button>
              )}

              {onCloseDocument && (
                <button
                  type="button"
                  className="document-header__button"
                  onClick={onCloseDocument}
                  aria-label="Dokument schliessen"
                >
                  <X size={16} />
                </button>
              )}
            </div>
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
        </>
      ) : (
        <div className="summary-body" ref={viewerRef}>
          {renderSummary()}
        </div>
      )}

      <style jsx>{`
        .enhanced-document-viewer {
          height: 100%;
          display: flex;
          flex-direction: column;
          background: rgba(255, 252, 246, 0.84);
        }

        .document-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 18px 20px;
          border-bottom: 1px solid rgba(34, 29, 20, 0.12);
          background: rgba(255, 251, 245, 0.88);
        }

        .document-header__primary {
          display: flex;
          align-items: center;
          gap: 14px;
          min-width: 0;
        }

        .document-header__icon {
          width: 42px;
          height: 42px;
          border-radius: 14px;
          background: rgba(0, 0, 0, 0.05);
          color: #29251f;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .document-header__copy {
          min-width: 0;
        }

        .document-header__copy h2 {
          margin: 0 0 6px;
          font-size: 1.12rem;
          color: #25211a;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .document-header__meta {
          display: flex;
          flex-wrap: wrap;
          gap: 10px 18px;
          color: #756d61;
          font-size: 0.82rem;
        }

        .document-header__meta span {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .document-header__actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .document-header__button {
          width: 36px;
          height: 36px;
          border-radius: 999px;
          border: 1px solid rgba(34, 29, 20, 0.12);
          background: rgba(255, 255, 255, 0.84);
          color: #2b2620;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .document-header__button:hover:not(:disabled) {
          background: #ffffff;
        }

        .document-header__button:disabled {
          opacity: 0.38;
          cursor: not-allowed;
        }

        .document-body,
        .summary-body {
          flex: 1;
          min-height: 0;
          position: relative;
          overflow: auto;
        }

        .summary-body {
          background: #f2f0eb;
        }

        .viewer-loading,
        .summary-state,
        .document-fallback {
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 14px;
          padding: 32px;
          text-align: center;
          color: #6b6458;
        }

        .summary-state--error {
          color: #923d35;
        }

        .viewer-loading__spinner {
          width: 34px;
          height: 34px;
          border-radius: 999px;
          border: 3px solid rgba(34, 29, 20, 0.14);
          border-top-color: #25211a;
          animation: spin 0.8s linear infinite;
        }

        .summary-reader {
          max-width: 980px;
          margin: 0 auto;
          padding: 28px 24px 40px;
          color: #25211a;
        }

        .summary-divider {
          display: flex;
          align-items: center;
          gap: 14px;
          color: #8c8477;
          font-size: 0.86rem;
          margin-bottom: 18px;
        }

        .summary-divider::before,
        .summary-divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: rgba(34, 29, 20, 0.18);
        }

        .summary-reader__body {
          font-size: 1rem;
          line-height: 1.9;
        }

        .summary-markdown__heading {
          margin: 30px 0 12px;
          font-size: 1.65rem;
          line-height: 1.16;
          color: #201b16;
        }

        .summary-markdown__heading:first-child {
          margin-top: 8px;
        }

        .summary-markdown__paragraph {
          margin: 0 0 16px;
        }

        .summary-markdown__list {
          margin: 0;
          padding-left: 24px;
        }

        .summary-markdown__item {
          margin: 0 0 16px;
          color: #2f2922;
        }

        .summary-reader__meta {
          margin: 22px 0 0;
          color: #867d70;
          font-size: 0.82rem;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 768px) {
          .document-header {
            padding: 14px 16px;
          }

          .summary-reader {
            padding: 20px 18px 30px;
          }

          .summary-markdown__heading {
            font-size: 1.32rem;
          }
        }
      `}</style>
    </div>
  );
};

export default EnhancedDocumentViewer;
