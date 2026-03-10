import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  MoreVertical,
  Search,
  TextCursorInput,
  X,
} from 'lucide-react';

let pdfWorkerConfigured = false;

const configurePdfWorker = () => {
  if (typeof window === 'undefined' || pdfWorkerConfigured) {
    return;
  }

  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();
  pdfWorkerConfigured = true;
};

if (typeof window !== 'undefined') {
  configurePdfWorker();
}

export interface PDFViewerState {
  pageNumber: number;
  scale: number;
  searchQuery: string;
  activeMatchIndex: number;
}

interface PDFViewerProps {
  file?: File;
  url?: string;
  state?: PDFViewerState;
  onStateChange?: (nextState: Partial<PDFViewerState>) => void;
  onDownload?: () => void;
  onCloseDocument?: () => void;
  downloadDisabled?: boolean;
}

interface SearchMatch {
  pageNumber: number;
  startIndex: number;
  snippet: string;
}

const DEFAULT_VIEWER_STATE: PDFViewerState = {
  pageNumber: 1,
  scale: 1,
  searchQuery: '',
  activeMatchIndex: -1,
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const normalizeText = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim();

const buildSearchMatches = (pageTexts: string[], query: string): SearchMatch[] => {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) {
    return [];
  }

  const matches: SearchMatch[] = [];

  pageTexts.forEach((pageText, pageIndex) => {
    const normalizedPageText = normalizeText(pageText);
    if (!normalizedPageText) {
      return;
    }

    let cursor = 0;
    while (cursor < normalizedPageText.length) {
      const matchIndex = normalizedPageText.indexOf(normalizedQuery, cursor);
      if (matchIndex === -1) {
        break;
      }

      const snippetStart = Math.max(matchIndex - 36, 0);
      const snippetEnd = Math.min(matchIndex + normalizedQuery.length + 52, normalizedPageText.length);
      matches.push({
        pageNumber: pageIndex + 1,
        startIndex: matchIndex,
        snippet: normalizedPageText.slice(snippetStart, snippetEnd).trim(),
      });

      cursor = matchIndex + normalizedQuery.length;
    }
  });

  return matches;
};

const buildHighlightTerms = (query: string): string[] => {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) {
    return [];
  }

  const terms = normalizedQuery
    .split(' ')
    .map((term) => term.trim())
    .filter((term) => term.length > 1);

  return Array.from(new Set([normalizedQuery, ...terms])).sort((left, right) => right.length - left.length);
};

const PDFViewer: React.FC<PDFViewerProps> = ({
  file,
  url,
  state,
  onStateChange,
  onDownload,
  onCloseDocument,
  downloadDisabled = false,
}) => {
  const isControlled = state !== undefined && typeof onStateChange === 'function';
  const [internalState, setInternalState] = useState<PDFViewerState>(DEFAULT_VIEWER_STATE);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isIndexingPages, setIsIndexingPages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renderTextLayer, setRenderTextLayer] = useState(true);
  const [pageTexts, setPageTexts] = useState<string[]>([]);
  const [searchMatches, setSearchMatches] = useState<SearchMatch[]>([]);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [pageInputValue, setPageInputValue] = useState('1');
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const pageShellRef = useRef<HTMLDivElement>(null);
  const searchIndexJobRef = useRef(0);

  const documentSource = file ?? url;
  const viewerState = isControlled
    ? { ...DEFAULT_VIEWER_STATE, ...(state || {}) }
    : internalState;

  const updateViewerState = useCallback((nextState: Partial<PDFViewerState>) => {
    if (isControlled) {
      onStateChange?.(nextState);
      return;
    }

    setInternalState((current) => ({
      ...current,
      ...nextState,
    }));
  }, [isControlled, onStateChange]);

  const activeMatch = viewerState.activeMatchIndex >= 0
    ? searchMatches[viewerState.activeMatchIndex] || null
    : null;

  const resultLabel = searchMatches.length > 0 && viewerState.activeMatchIndex >= 0
    ? `${viewerState.activeMatchIndex + 1} / ${searchMatches.length}`
    : searchMatches.length > 0
      ? `1 / ${searchMatches.length}`
      : '0 / 0';

  const onDocumentLoadSuccess = useCallback(async (loadedDocument: { numPages: number; getPage: (pageNumber: number) => Promise<any> }) => {
    setNumPages(loadedDocument.numPages);
    setIsLoading(false);
    setError(null);

    if (viewerState.pageNumber > loadedDocument.numPages || viewerState.pageNumber < 1) {
      updateViewerState({ pageNumber: 1 });
    }

    setIsIndexingPages(true);
    const jobId = ++searchIndexJobRef.current;
    const texts: string[] = [];

    try {
      for (let pageNumber = 1; pageNumber <= loadedDocument.numPages; pageNumber++) {
        const page = await loadedDocument.getPage(pageNumber);
        const textContent = await page.getTextContent();
        const joinedText = textContent.items
          .map((item: any) => ('str' in item ? item.str : ''))
          .join(' ');
        texts.push(joinedText);
      }

      if (jobId === searchIndexJobRef.current) {
        setPageTexts(texts);
      }
    } catch (loadError) {
      console.error('Failed to extract searchable PDF text:', loadError);
      if (jobId === searchIndexJobRef.current) {
        setPageTexts([]);
      }
    } finally {
      if (jobId === searchIndexJobRef.current) {
        setIsIndexingPages(false);
      }
    }
  }, [updateViewerState, viewerState.pageNumber]);

  const onDocumentLoadError = useCallback((loadError: Error) => {
    console.error('PDF loading error:', loadError);
    setError('Fehler beim Laden des PDF-Dokuments');
    setIsLoading(false);
  }, []);

  useEffect(() => {
    configurePdfWorker();
  }, []);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    setNumPages(null);
    setPageTexts([]);
    setSearchMatches([]);
    searchIndexJobRef.current += 1;
    setActionMenuOpen(false);
  }, [documentSource]);

  useEffect(() => {
    setPageInputValue(String(viewerState.pageNumber));
  }, [viewerState.pageNumber]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) {
        setActionMenuOpen(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, []);

  useEffect(() => {
    const matches = buildSearchMatches(pageTexts, viewerState.searchQuery);
    setSearchMatches(matches);

    if (!viewerState.searchQuery.trim()) {
      if (viewerState.activeMatchIndex !== -1) {
        updateViewerState({ activeMatchIndex: -1 });
      }
      return;
    }

    if (matches.length === 0) {
      if (viewerState.activeMatchIndex !== -1) {
        updateViewerState({ activeMatchIndex: -1 });
      }
      return;
    }

    const nextIndex = clamp(
      viewerState.activeMatchIndex >= 0 ? viewerState.activeMatchIndex : 0,
      0,
      matches.length - 1,
    );

    const nextPatch: Partial<PDFViewerState> = {};
    if (viewerState.activeMatchIndex !== nextIndex) {
      nextPatch.activeMatchIndex = nextIndex;
    }
    if (viewerState.pageNumber !== matches[nextIndex].pageNumber) {
      nextPatch.pageNumber = matches[nextIndex].pageNumber;
    }

    if (Object.keys(nextPatch).length > 0) {
      updateViewerState(nextPatch);
    }
  }, [
    pageTexts,
    updateViewerState,
    viewerState.activeMatchIndex,
    viewerState.pageNumber,
    viewerState.searchQuery,
  ]);

  useEffect(() => {
    if (!renderTextLayer || !pageShellRef.current) {
      return;
    }

    const textLayerRoot = pageShellRef.current.querySelector('.react-pdf__Page__textContent');
    if (!textLayerRoot) {
      return;
    }

    const spans = Array.from(textLayerRoot.querySelectorAll('span'));
    const highlightTerms = buildHighlightTerms(viewerState.searchQuery);
    const activePageMatch = activeMatch?.pageNumber === viewerState.pageNumber ? activeMatch : null;
    let activeAssigned = false;

    spans.forEach((span) => {
      span.removeAttribute('data-search-hit');
      span.removeAttribute('data-search-active');

      const normalizedSpanText = normalizeText(span.textContent || '');
      if (!normalizedSpanText || highlightTerms.length === 0) {
        return;
      }

      const isHit = highlightTerms.some((term) => normalizedSpanText.includes(term));
      if (!isHit) {
        return;
      }

      span.setAttribute('data-search-hit', 'true');
      if (!activeAssigned && activePageMatch) {
        span.setAttribute('data-search-active', 'true');
        activeAssigned = true;
      }
    });
  }, [activeMatch, renderTextLayer, viewerState.pageNumber, viewerState.searchQuery]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        updateViewerState({
          pageNumber: clamp(viewerState.pageNumber - 1, 1, numPages || 1),
        });
      } else if (event.key === 'ArrowRight') {
        updateViewerState({
          pageNumber: clamp(viewerState.pageNumber + 1, 1, numPages || 1),
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [numPages, updateViewerState, viewerState.pageNumber]);

  const goToPreviousPage = () => {
    updateViewerState({ pageNumber: clamp(viewerState.pageNumber - 1, 1, numPages || 1) });
  };

  const goToNextPage = () => {
    updateViewerState({ pageNumber: clamp(viewerState.pageNumber + 1, 1, numPages || 1) });
  };

  const handlePageInputCommit = () => {
    const nextPage = Number.parseInt(pageInputValue, 10);
    if (Number.isNaN(nextPage)) {
      setPageInputValue(String(viewerState.pageNumber));
      return;
    }

    updateViewerState({ pageNumber: clamp(nextPage, 1, numPages || 1) });
  };

  const zoomIn = () => {
    updateViewerState({ scale: Math.min(viewerState.scale + 0.15, 3) });
  };

  const zoomOut = () => {
    updateViewerState({ scale: Math.max(viewerState.scale - 0.15, 0.6) });
  };

  const resetZoom = () => {
    updateViewerState({ scale: 1 });
    setActionMenuOpen(false);
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    updateViewerState({
      searchQuery: event.target.value,
      activeMatchIndex: -1,
    });
  };

  const clearSearch = () => {
    updateViewerState({
      searchQuery: '',
      activeMatchIndex: -1,
    });
  };

  const goToSearchMatch = (direction: -1 | 1) => {
    if (searchMatches.length === 0) {
      return;
    }

    const currentIndex = viewerState.activeMatchIndex >= 0 ? viewerState.activeMatchIndex : 0;
    const nextIndex = (currentIndex + direction + searchMatches.length) % searchMatches.length;
    const nextMatch = searchMatches[nextIndex];

    updateViewerState({
      activeMatchIndex: nextIndex,
      pageNumber: nextMatch.pageNumber,
    });
  };

  const searchTerms = useMemo(() => buildHighlightTerms(viewerState.searchQuery), [viewerState.searchQuery]);

  if (!documentSource) {
    return (
      <div className="pdf-error" role="alert">
        <h3>Kein PDF verfuegbar</h3>
        <p>Das Dokument kann in dieser Sitzung nicht angezeigt werden.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pdf-error" role="alert" data-testid="pdf-load-error">
        <h3>PDF konnte nicht geladen werden</h3>
        <p>{error}</p>

        <style jsx>{`
          .pdf-error {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            gap: 10px;
            color: #9c3f37;
            text-align: center;
            padding: 32px;
          }

          .pdf-error h3,
          .pdf-error p {
            margin: 0;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="pdf-viewer-container" data-testid="pdf-viewer">
      <div className="pdf-toolbar">
        <div className="pdf-toolbar__left">
          <div className="pdf-search" data-testid="pdf-search-control">
            <Search size={16} />
            <input
              type="text"
              value={viewerState.searchQuery}
              onChange={handleSearchChange}
              placeholder="Find im Dokument"
              aria-label="Im PDF suchen"
              data-testid="pdf-search-input"
            />
            {viewerState.searchQuery && (
              <button
                type="button"
                className="pdf-search__clear"
                onClick={clearSearch}
                aria-label="Suche leeren"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="pdf-result-pill" data-testid="pdf-search-count">
            {isIndexingPages && searchTerms.length > 0 ? 'Suche...' : resultLabel}
          </div>

          <div className="pdf-page-controls">
            <button
              type="button"
              className="toolbar-button"
              onClick={goToPreviousPage}
              disabled={viewerState.pageNumber <= 1}
              aria-label="Vorherige Seite"
            >
              <ChevronLeft size={18} />
            </button>

            <div className="pdf-page-indicator">
              <input
                type="number"
                value={pageInputValue}
                min={1}
                max={numPages || 1}
                onChange={(event) => setPageInputValue(event.target.value)}
                onBlur={handlePageInputCommit}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handlePageInputCommit();
                  }
                }}
                aria-label="Seite"
              />
              <span>/ {numPages || '-'}</span>
            </div>

            <button
              type="button"
              className="toolbar-button"
              onClick={goToNextPage}
              disabled={viewerState.pageNumber >= (numPages || 1)}
              aria-label="Naechste Seite"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div className="pdf-toolbar__center">
          <button type="button" className="toolbar-button" onClick={zoomOut} aria-label="Verkleinern">
            -
          </button>
          <button type="button" className="toolbar-button toolbar-button--value" onClick={resetZoom}>
            {Math.round(viewerState.scale * 100)}%
          </button>
          <button type="button" className="toolbar-button" onClick={zoomIn} aria-label="Vergroessern">
            +
          </button>
        </div>

        <div className="pdf-toolbar__right">
          <button
            type="button"
            className="toolbar-button"
            onClick={() => goToSearchMatch(-1)}
            disabled={searchMatches.length === 0}
            aria-label="Vorheriger Treffer"
          >
            <ChevronLeft size={18} />
          </button>

          <button
            type="button"
            className="toolbar-button"
            onClick={() => goToSearchMatch(1)}
            disabled={searchMatches.length === 0}
            aria-label="Naechster Treffer"
          >
            <ChevronRight size={18} />
          </button>

          <button
            type="button"
            className="toolbar-button"
            onClick={onDownload}
            disabled={downloadDisabled}
            aria-label="PDF herunterladen"
          >
            <Download size={16} />
          </button>

          <div className="pdf-actions" ref={actionMenuRef}>
            <button
              type="button"
              className="toolbar-button"
              onClick={() => setActionMenuOpen((current) => !current)}
              aria-haspopup="menu"
              aria-expanded={actionMenuOpen}
              aria-label="Weitere PDF-Aktionen"
            >
              <MoreVertical size={16} />
            </button>

            {actionMenuOpen && (
              <div className="pdf-actions__menu" role="menu">
                <button
                  type="button"
                  className="pdf-actions__item"
                  onClick={() => {
                    setRenderTextLayer((current) => !current);
                    setActionMenuOpen(false);
                  }}
                >
                  <TextCursorInput size={15} />
                  <span>{renderTextLayer ? 'Textauswahl aus' : 'Textauswahl an'}</span>
                </button>
                <button
                  type="button"
                  className="pdf-actions__item"
                  onClick={() => {
                    updateViewerState({ pageNumber: 1 });
                    setActionMenuOpen(false);
                  }}
                >
                  <ChevronLeft size={15} />
                  <span>Zur ersten Seite</span>
                </button>
                <button type="button" className="pdf-actions__item" onClick={resetZoom}>
                  <span>Zoom zuruecksetzen</span>
                </button>
                {onCloseDocument && (
                  <button
                    type="button"
                    className="pdf-actions__item pdf-actions__item--danger"
                    onClick={onCloseDocument}
                  >
                    <X size={15} />
                    <span>Dokument schliessen</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="pdf-document-wrapper" ref={pageShellRef}>
        {isLoading && (
          <div className="pdf-loading">
            <div className="pdf-loading__spinner" />
            <p>PDF wird geladen...</p>
          </div>
        )}

        <Document
          file={documentSource}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={<div />}
        >
          <Page
            pageNumber={viewerState.pageNumber}
            scale={viewerState.scale}
            renderTextLayer={renderTextLayer}
            renderAnnotationLayer
            className="pdf-page"
          />
        </Document>
      </div>

      <style jsx>{`
        .pdf-viewer-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #ebe7e0;
        }

        .pdf-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 12px 16px;
          border-bottom: 1px solid rgba(31, 26, 18, 0.12);
          background: rgba(247, 244, 238, 0.96);
        }

        .pdf-toolbar__left,
        .pdf-toolbar__center,
        .pdf-toolbar__right {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .pdf-toolbar__left {
          flex: 1;
        }

        .pdf-search {
          min-width: 220px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 0 12px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.8);
          border: 1px solid rgba(31, 26, 18, 0.12);
        }

        .pdf-search input {
          width: 100%;
          border: none;
          background: transparent;
          padding: 10px 0;
          font-size: 0.92rem;
          color: #25211a;
          outline: none;
        }

        .pdf-search__clear,
        .toolbar-button {
          border: 1px solid rgba(31, 26, 18, 0.12);
          background: rgba(255, 255, 255, 0.8);
          color: #2c2822;
          border-radius: 12px;
          height: 38px;
          min-width: 38px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .toolbar-button:hover:not(:disabled),
        .pdf-search__clear:hover {
          background: #ffffff;
        }

        .toolbar-button:disabled {
          opacity: 0.38;
          cursor: not-allowed;
        }

        .toolbar-button--value {
          padding: 0 14px;
          min-width: 64px;
          font-size: 0.9rem;
        }

        .pdf-result-pill {
          min-width: 62px;
          padding: 9px 12px;
          border-radius: 999px;
          background: rgba(31, 26, 18, 0.06);
          color: #6a6458;
          font-size: 0.8rem;
          text-align: center;
        }

        .pdf-page-controls {
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }

        .pdf-page-indicator {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 0 12px;
          height: 38px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.8);
          border: 1px solid rgba(31, 26, 18, 0.12);
        }

        .pdf-page-indicator input {
          width: 48px;
          border: none;
          background: transparent;
          text-align: center;
          font-size: 0.92rem;
          color: #25211a;
          outline: none;
        }

        .pdf-actions {
          position: relative;
        }

        .pdf-actions__menu {
          position: absolute;
          right: 0;
          top: calc(100% + 10px);
          min-width: 220px;
          padding: 10px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.96);
          border: 1px solid rgba(31, 26, 18, 0.12);
          box-shadow: 0 22px 36px rgba(52, 41, 20, 0.12);
          z-index: 12;
        }

        .pdf-actions__item {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border: none;
          background: transparent;
          border-radius: 12px;
          color: #2c2822;
          text-align: left;
          cursor: pointer;
        }

        .pdf-actions__item:hover {
          background: rgba(0, 0, 0, 0.04);
        }

        .pdf-actions__item--danger {
          color: #9d3d35;
        }

        .pdf-document-wrapper {
          flex: 1;
          min-height: 0;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          overflow: auto;
          padding: 30px 18px 42px;
          position: relative;
          background: #dfdbd4;
        }

        .pdf-loading {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          z-index: 10;
          color: #615b50;
        }

        .pdf-loading p {
          margin: 0;
        }

        .pdf-loading__spinner {
          width: 34px;
          height: 34px;
          border-radius: 999px;
          border: 3px solid rgba(31, 26, 18, 0.14);
          border-top-color: #2c2822;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        :global(.pdf-page) {
          background: #ffffff;
          border-radius: 6px;
          overflow: hidden;
          box-shadow: 0 26px 40px rgba(56, 45, 24, 0.12);
        }

        :global(.react-pdf__Page__canvas) {
          display: block;
        }

        :global(.react-pdf__Page__textContent) {
          user-select: text !important;
          cursor: text;
        }

        :global(.react-pdf__Page__textContent span) {
          position: absolute;
          color: transparent;
          border-radius: 2px;
          transition: background-color 0.12s ease;
        }

        :global(.react-pdf__Page__textContent span[data-search-hit="true"]) {
          background: rgba(255, 214, 91, 0.38);
        }

        :global(.react-pdf__Page__textContent span[data-search-active="true"]) {
          background: rgba(255, 188, 42, 0.58);
        }

        :global(.react-pdf__Page__textContent span::selection) {
          background: rgba(61, 131, 255, 0.28);
        }

        @media (max-width: 1080px) {
          .pdf-toolbar {
            flex-wrap: wrap;
          }

          .pdf-toolbar__left,
          .pdf-toolbar__right {
            width: 100%;
            justify-content: space-between;
          }

          .pdf-toolbar__center {
            margin-left: auto;
          }
        }

        @media (max-width: 768px) {
          .pdf-toolbar {
            padding: 12px;
            gap: 12px;
          }

          .pdf-toolbar__left {
            flex-wrap: wrap;
          }

          .pdf-search {
            min-width: 0;
            flex: 1 1 100%;
          }

          .pdf-document-wrapper {
            padding: 20px 10px 26px;
          }
        }
      `}</style>
    </div>
  );
};

export default PDFViewer;
