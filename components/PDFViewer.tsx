import React, { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';

// Configure PDF.js worker for build compatibility
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/legacy/build/pdf.worker.min.js`;
}

interface PDFViewerProps {
  file?: File;
  url?: string;
}

const PDFViewer: React.FC<PDFViewerProps> = ({ file, url }) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [renderTextLayer, setRenderTextLayer] = useState(true);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setIsLoading(false);
    setError(null);
  };

  const onDocumentLoadError = (error: Error) => {
    console.error('PDF loading error:', error);
    setError('Fehler beim Laden des PDF-Dokuments');
    setIsLoading(false);
  };

  const goToPreviousPage = () => {
    setPageNumber(prevPageNumber => Math.max(prevPageNumber - 1, 1));
  };

  const goToNextPage = () => {
    setPageNumber(prevPageNumber => Math.min(prevPageNumber + 1, numPages || 1));
  };

  const handlePageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 1 && value <= (numPages || 1)) {
      setPageNumber(value);
    }
  };

  const zoomIn = () => {
    setScale(prevScale => Math.min(prevScale + 0.2, 3.0));
  };

  const zoomOut = () => {
    setScale(prevScale => Math.max(prevScale - 0.2, 0.5));
  };

  const resetZoom = () => {
    setScale(1.0);
  };

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        goToPreviousPage();
      } else if (e.key === 'ArrowRight') {
        goToNextPage();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [numPages]);

  if (error) {
    return (
      <div className="pdf-error">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <h3>PDF konnte nicht geladen werden</h3>
        <p>{error}</p>
        <style jsx>{`
          .pdf-error {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: #ef4444;
            text-align: center;
            padding: 2rem;
          }

          .pdf-error svg {
            margin-bottom: 1rem;
          }

          .pdf-error h3 {
            font-size: 1.25rem;
            margin-bottom: 0.5rem;
          }

          .pdf-error p {
            color: #6b7280;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="pdf-viewer-container">
      {/* PDF Controls */}
      <div className="pdf-controls">
        <div className="pdf-controls-left">
          <button
            onClick={goToPreviousPage}
            disabled={pageNumber <= 1}
            className="control-button"
            title="Vorherige Seite (←)"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>

          <div className="page-info">
            <input
              type="number"
              value={pageNumber}
              onChange={handlePageChange}
              className="page-input"
              min="1"
              max={numPages || 1}
            />
            <span className="page-separator">/</span>
            <span className="total-pages">{numPages || '-'}</span>
          </div>

          <button
            onClick={goToNextPage}
            disabled={pageNumber >= (numPages || 1)}
            className="control-button"
            title="Nächste Seite (→)"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </div>

        <div className="pdf-controls-center">
          <button
            onClick={zoomOut}
            className="control-button"
            title="Verkleinern"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
              <line x1="8" y1="11" x2="14" y2="11"></line>
            </svg>
          </button>

          <button
            onClick={resetZoom}
            className="control-button zoom-level"
            title="Zoom zurücksetzen"
          >
            {Math.round(scale * 100)}%
          </button>

          <button
            onClick={zoomIn}
            className="control-button"
            title="Vergrößern"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
              <line x1="11" y1="8" x2="11" y2="14"></line>
              <line x1="8" y1="11" x2="14" y2="11"></line>
            </svg>
          </button>
        </div>

        <div className="pdf-controls-right">
          <button
            onClick={() => setRenderTextLayer(!renderTextLayer)}
            className={`control-button ${renderTextLayer ? 'active' : ''}`}
            title={renderTextLayer ? 'Textauswahl deaktivieren' : 'Textauswahl aktivieren'}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 7V4h16v3"></path>
              <path d="M9 20h6"></path>
              <path d="M12 4v16"></path>
            </svg>
          </button>
        </div>
      </div>

      {/* PDF Document */}
      <div className="pdf-document-wrapper">
        {isLoading && (
          <div className="pdf-loading">
            <div className="spinner"></div>
            <p>PDF wird geladen...</p>
          </div>
        )}

        <Document
          file={file}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={<div></div>}
        >
          <Page
            pageNumber={pageNumber}
            scale={scale}
            renderTextLayer={renderTextLayer}
            renderAnnotationLayer={true}
            className="pdf-page"
          />
        </Document>
      </div>

      <style jsx>{`
        .pdf-viewer-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #f9fafb;
          border-radius: 8px;
          overflow: hidden;
        }

        .pdf-controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 1rem;
          background: white;
          border-bottom: 1px solid #e5e7eb;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
          gap: 1rem;
        }

        .pdf-controls-left,
        .pdf-controls-center,
        .pdf-controls-right {
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

        .control-button:hover:not(:disabled) {
          background: #f3f4f6;
          border-color: #d1d5db;
          color: #1f2937;
        }

        .control-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .control-button.active {
          background: #0066CC;
          color: white;
          border-color: #0066CC;
        }

        .control-button.zoom-level {
          width: auto;
          padding: 0 0.75rem;
          font-size: 0.875rem;
          font-weight: 500;
        }

        .page-info {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.75rem;
          background: #f9fafb;
          border-radius: 6px;
          border: 1px solid #e5e7eb;
        }

        .page-input {
          width: 50px;
          padding: 0.25rem;
          text-align: center;
          border: none;
          background: transparent;
          font-size: 0.875rem;
          font-weight: 500;
          color: #1f2937;
        }

        .page-input:focus {
          outline: none;
          background: white;
          border-radius: 4px;
        }

        .page-separator {
          color: #9ca3af;
          font-size: 0.875rem;
        }

        .total-pages {
          font-size: 0.875rem;
          font-weight: 500;
          color: #1f2937;
        }

        .pdf-document-wrapper {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: auto;
          padding: 2rem;
          position: relative;
        }

        .pdf-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          z-index: 10;
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

        .pdf-loading p {
          color: #6b7280;
          font-size: 0.875rem;
        }

        :global(.pdf-page) {
          background: white;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          border-radius: 4px;
          overflow: hidden;
        }

        :global(.react-pdf__Page__textContent) {
          user-select: text !important;
          cursor: text;
        }

        :global(.react-pdf__Page__textContent span) {
          position: absolute;
          color: transparent;
          cursor: text;
        }

        :global(.react-pdf__Page__textContent span::selection) {
          background: rgba(0, 102, 204, 0.3);
        }

        @media (max-width: 768px) {
          .pdf-controls {
            flex-wrap: wrap;
            padding: 0.5rem;
          }

          .pdf-controls-left,
          .pdf-controls-center,
          .pdf-controls-right {
            flex: 1;
            justify-content: center;
          }

          .pdf-document-wrapper {
            padding: 1rem;
          }
        }
      `}</style>
    </div>
  );
};

export default PDFViewer;