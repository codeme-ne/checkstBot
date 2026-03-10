import type { NextPage } from 'next';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Download,
  FileText,
  MoreHorizontal,
  Plus,
  Sparkles,
  X,
} from 'lucide-react';
import ChatInterface, { ChatInterfaceHandle } from '../components/ChatInterface';
import EnhancedDocumentViewer from '../components/EnhancedDocumentViewer';
import FileUpload, { FileUploadHandle } from '../components/FileUpload';
import { fetchCSRFToken } from '../lib/csrf-client';
import type { PDFViewerState } from '../components/PDFViewer';

interface Document {
  id: string;
  documentId: string;
  title: string;
  content: string;
  type: string;
  uploadDate: string;
  file?: File;
}

type StoredDocument = Omit<Document, 'documentId' | 'file'> & { documentId?: string };
type ViewerMode = 'document' | 'summary';

interface SummaryCacheEntry {
  status: 'idle' | 'loading' | 'ready' | 'error';
  markdown?: string;
  error?: string;
  generatedAt?: string;
}

type SummaryCache = Record<string, SummaryCacheEntry>;
type PDFViewerStateMap = Record<string, PDFViewerState>;

const MAX_EXPLAIN_SELECTION_CHARS = 2000;
const EMPTY_SUMMARY_STATE: SummaryCacheEntry = { status: 'idle' };
const DEFAULT_PDF_VIEWER_STATE: PDFViewerState = {
  pageNumber: 1,
  scale: 1,
  searchQuery: '',
  activeMatchIndex: -1,
};

const isStoredDocument = (doc: unknown): doc is StoredDocument => {
  if (!doc || typeof doc !== 'object') {
    return false;
  }

  const candidate = doc as Record<string, unknown>;
  return typeof candidate.id === 'string'
    && typeof candidate.title === 'string'
    && typeof candidate.type === 'string'
    && typeof candidate.uploadDate === 'string'
    && typeof candidate.content === 'string'
    && (candidate.documentId === undefined || typeof candidate.documentId === 'string');
};

const createPDFViewerState = (current?: PDFViewerState): PDFViewerState => ({
  ...DEFAULT_PDF_VIEWER_STATE,
  ...(current || {}),
});

const Home: NextPage = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [activeDocument, setActiveDocument] = useState<string | null>(null);
  const [previousDocumentId, setPreviousDocumentId] = useState<string | null>(null);
  const [viewerMode, setViewerMode] = useState<ViewerMode>('document');
  const [summaryCache, setSummaryCache] = useState<SummaryCache>({});
  const [pdfViewerStates, setPdfViewerStates] = useState<PDFViewerStateMap>({});
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [queuedMessage, setQueuedMessage] = useState<string | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const chatInterfaceRef = useRef<ChatInterfaceHandle>(null);
  const hiddenUploadRef = useRef<FileUploadHandle>(null);
  const workspaceMenuRef = useRef<HTMLDivElement>(null);

  const persistDocuments = useCallback((nextDocuments: Document[]) => {
    setDocuments(nextDocuments);

    try {
      localStorage.setItem(
        'chat_documents',
        JSON.stringify(nextDocuments.map(({ file, ...storedDoc }) => storedDoc)),
      );
    } catch (error) {
      console.error('Failed to save documents to storage', error);
    }
  }, []);

  useEffect(() => {
    try {
      const savedDocs = localStorage.getItem('chat_documents');
      if (!savedDocs) {
        return;
      }

      const parsedDocs = JSON.parse(savedDocs)
        .filter(isStoredDocument)
        .map((doc: StoredDocument) => ({
          ...doc,
          documentId: doc.documentId || doc.id,
          file: undefined,
        }));

      setDocuments(parsedDocs);
      if (parsedDocs.length > 0) {
        setActiveDocument((current) => current ?? parsedDocs[0].id);
      }
    } catch (error) {
      console.error('Failed to load documents from storage', error);
    }
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (workspaceMenuRef.current && !workspaceMenuRef.current.contains(event.target as Node)) {
        setWorkspaceMenuOpen(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const activeDoc = useMemo(
    () => documents.find((doc) => doc.id === activeDocument) || null,
    [documents, activeDocument],
  );

  const activeSummaryState = activeDoc ? summaryCache[activeDoc.id] || EMPTY_SUMMARY_STATE : EMPTY_SUMMARY_STATE;
  const activePDFViewerState = activeDoc
    ? createPDFViewerState(pdfViewerStates[activeDoc.id])
    : DEFAULT_PDF_VIEWER_STATE;

  const handleQueueConsumed = useCallback(() => {
    setQueuedMessage(null);
    setTimeout(() => setIsExplaining(false), 1000);
  }, []);

  const handleExplainText = useCallback((text: string) => {
    const normalizedText = text.replace(/\s+/g, ' ').trim();
    const explainText = normalizedText.length > MAX_EXPLAIN_SELECTION_CHARS
      ? `${normalizedText.slice(0, MAX_EXPLAIN_SELECTION_CHARS)}...`
      : normalizedText;
    setQueuedMessage(`Bitte erklaere dieses Zitat praezise und verstaendlich:\n\n"${explainText}"`);
    setIsExplaining(true);
  }, []);

  const selectDocument = useCallback((documentId: string) => {
    setWorkspaceMenuOpen(false);
    setViewerMode('document');
    setActiveDocument((current) => {
      if (!current || current === documentId) {
        return current || documentId;
      }

      setPreviousDocumentId(current);
      return documentId;
    });
  }, []);

  const handleBackNavigation = useCallback(() => {
    if (!previousDocumentId || !activeDocument) {
      return;
    }

    setWorkspaceMenuOpen(false);
    setViewerMode('document');
    setActiveDocument(previousDocumentId);
    setPreviousDocumentId(activeDocument);
  }, [activeDocument, previousDocumentId]);

  const handleUploadComplete = useCallback((doc: { id: string; title: string; content?: string; file?: File }) => {
    const generatedId = globalThis.crypto.randomUUID();
    const newDocument: Document = {
      id: generatedId,
      documentId: doc.id,
      title: doc.title,
      content: doc.content || '[Content stored in vector database]',
      type: doc.file?.type || 'uploaded',
      uploadDate: new Date().toISOString(),
      file: doc.file,
    };

    setPreviousDocumentId(activeDocument);
    setViewerMode('document');
    setSummaryCache((current) => ({
      ...current,
      [generatedId]: EMPTY_SUMMARY_STATE,
    }));
    setPdfViewerStates((current) => ({
      ...current,
      [generatedId]: DEFAULT_PDF_VIEWER_STATE,
    }));
    setActiveDocument(generatedId);
    persistDocuments([...documents, newDocument]);
    setIsUploading(false);
    setUploadError(null);
  }, [activeDocument, documents, persistDocuments]);

  const handleRemoveDocument = useCallback((documentId: string) => {
    setWorkspaceMenuOpen(false);

    const nextDocuments = documents.filter((doc) => doc.id !== documentId);
    persistDocuments(nextDocuments);

    setSummaryCache((current) => {
      const next = { ...current };
      delete next[documentId];
      return next;
    });

    setPdfViewerStates((current) => {
      const next = { ...current };
      delete next[documentId];
      return next;
    });

    if (activeDocument === documentId) {
      const fallbackDocument = nextDocuments[0]?.id || null;
      setActiveDocument(fallbackDocument);
      setViewerMode('document');
      setPreviousDocumentId((current) => {
        if (!current || current === documentId || !nextDocuments.some((doc) => doc.id === current)) {
          return null;
        }
        return current;
      });
      return;
    }

    if (previousDocumentId === documentId) {
      setPreviousDocumentId(null);
    }
  }, [activeDocument, documents, persistDocuments, previousDocumentId]);

  const handleDownloadDocument = useCallback(() => {
    if (!activeDoc?.file) {
      return;
    }

    const objectUrl = URL.createObjectURL(activeDoc.file);
    const anchor = window.document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = activeDoc.title;
    anchor.rel = 'noopener';
    window.document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    setWorkspaceMenuOpen(false);
  }, [activeDoc]);

  const handlePDFViewerStateChange = useCallback((nextState: Partial<PDFViewerState>) => {
    if (!activeDoc) {
      return;
    }

    setPdfViewerStates((current) => ({
      ...current,
      [activeDoc.id]: {
        ...createPDFViewerState(current[activeDoc.id]),
        ...nextState,
      },
    }));
  }, [activeDoc]);

  const handleSummaryToggle = useCallback(async () => {
    if (!activeDoc) {
      return;
    }

    if (viewerMode === 'summary') {
      setViewerMode('document');
      return;
    }

    const documentContent = activeDoc.content !== '[Content stored in vector database]'
      ? activeDoc.content
      : '';

    if (documentContent.trim().length < 40) {
      setSummaryCache((current) => ({
        ...current,
        [activeDoc.id]: {
          status: 'error',
          error: 'Fuer dieses Dokument ist in der laufenden Sitzung kein zusammenfassbarer Volltext verfuegbar.',
        },
      }));
      setViewerMode('summary');
      return;
    }

    const cachedSummary = summaryCache[activeDoc.id];
    if (cachedSummary?.status === 'ready') {
      setViewerMode('summary');
      return;
    }

    setSummaryCache((current) => ({
      ...current,
      [activeDoc.id]: {
        status: 'loading',
      },
    }));

    try {
      const csrfToken = await fetchCSRFToken();
      const response = await fetch('/api/summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({
          documentId: activeDoc.documentId,
          title: activeDoc.title,
          content: documentContent,
        }),
      });

      const responseText = await response.text();
      const payload = responseText ? JSON.parse(responseText) : {};

      if (!response.ok) {
        throw new Error(payload.error || `Summary request failed with status ${response.status}`);
      }

      setSummaryCache((current) => ({
        ...current,
        [activeDoc.id]: {
          status: 'ready',
          markdown: payload.summary,
          generatedAt: payload.generatedAt,
        },
      }));
      setViewerMode('summary');
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : 'Die Zusammenfassung konnte nicht geladen werden.';
      setSummaryCache((current) => ({
        ...current,
        [activeDoc.id]: {
          status: 'error',
          error: message,
        },
      }));
      setViewerMode('summary');
    }
  }, [activeDoc, summaryCache, viewerMode]);

  return (
    <>
      <div className="app-shell">
        <FileUpload
          ref={hiddenUploadRef}
          variant="hidden"
          onUploadComplete={handleUploadComplete}
          onUploadStart={() => setIsUploading(true)}
          onUploadError={(error) => {
            setUploadError(error);
            setIsUploading(false);
          }}
        />

        <section className="workspace-panel">
          <div className="workspace-chrome">
            <div className="workspace-nav">
              <button
                type="button"
                className="workspace-icon-button"
                onClick={handleBackNavigation}
                disabled={!previousDocumentId}
                aria-label="Vorheriges Dokument"
                title="Vorheriges Dokument"
              >
                <ArrowLeft size={18} />
              </button>

              <button
                type="button"
                className="workspace-icon-button"
                onClick={() => hiddenUploadRef.current?.openFilePicker()}
                aria-label="Dokument hochladen"
                title="Dokument hochladen"
              >
                <Plus size={18} />
              </button>

              <div className="workspace-tabs" role="tablist" aria-label="Dokumente">
                {documents.length === 0 ? (
                  <span className="workspace-tab workspace-tab--empty">Keine Dokumente</span>
                ) : (
                  documents.map((doc) => {
                    const isActive = doc.id === activeDocument;
                    return (
                      <button
                        key={doc.id}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        className={`workspace-tab ${isActive ? 'active' : ''}`}
                        onClick={() => selectDocument(doc.id)}
                      >
                        <span className="workspace-tab__dot" aria-hidden />
                        <span className="workspace-tab__label">{doc.title}</span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="workspace-tools">
              <button
                type="button"
                className={`workspace-toggle ${viewerMode === 'summary' ? 'summary-active' : ''}`}
                onClick={handleSummaryToggle}
                disabled={!activeDoc || activeSummaryState.status === 'loading'}
              >
                {activeSummaryState.status === 'loading' && viewerMode !== 'summary' ? (
                  <span className="workspace-toggle__spinner" aria-hidden />
                ) : (
                  <Sparkles size={14} />
                )}
                <span>{viewerMode === 'summary' ? 'Content' : 'Summary'}</span>
              </button>

              <div className="workspace-menu" ref={workspaceMenuRef}>
                <button
                  type="button"
                  className="workspace-icon-button"
                  aria-label="Dokumentaktionen"
                  aria-haspopup="menu"
                  aria-expanded={workspaceMenuOpen}
                  onClick={() => setWorkspaceMenuOpen((current) => !current)}
                >
                  <MoreHorizontal size={18} />
                </button>

                {workspaceMenuOpen && (
                  <div className="workspace-menu__content" role="menu">
                    <button
                      type="button"
                      role="menuitem"
                      className="workspace-menu__item"
                      onClick={handleDownloadDocument}
                      disabled={!activeDoc?.file}
                    >
                      <Download size={16} />
                      <span>Download</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="workspace-menu__item workspace-menu__item--danger"
                      onClick={() => activeDoc && handleRemoveDocument(activeDoc.id)}
                      disabled={!activeDoc}
                    >
                      <X size={16} />
                      <span>Dokument schliessen</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="workspace-canvas">
            {documents.length === 0 ? (
              <div className="workspace-empty">
                <div className="workspace-empty__intro">
                  <span className="workspace-empty__eyebrow">Dokumente</span>
                  <h1>OTIO-inspirierter Dokumenten-Workspace</h1>
                  <p>
                    Lade eine PDF, DOCX-, TXT- oder Markdown-Datei hoch. Danach stehen
                    Viewer, Summary-Toggle und der Assistent im selben Workspace bereit.
                  </p>
                </div>

                <div className="workspace-empty__dropzone">
                  <FileUpload
                    variant="dropzone"
                    onUploadComplete={handleUploadComplete}
                    onUploadStart={() => setIsUploading(true)}
                    onUploadError={(error) => {
                      setUploadError(error);
                      setIsUploading(false);
                    }}
                  />
                </div>

                {uploadError && <p className="workspace-empty__error">{uploadError}</p>}
              </div>
            ) : (
              <EnhancedDocumentViewer
                document={activeDoc}
                viewerMode={viewerMode}
                summaryState={activeSummaryState}
                onExplain={handleExplainText}
                onDownload={handleDownloadDocument}
                onCloseDocument={activeDoc ? () => handleRemoveDocument(activeDoc.id) : undefined}
                pdfViewerState={activePDFViewerState}
                onPDFViewerStateChange={handlePDFViewerStateChange}
                downloadDisabled={!activeDoc?.file}
              />
            )}
          </div>
        </section>

        <section className="assistant-panel">
          <div className="assistant-panel__header">
            <div>
              <p className="assistant-panel__eyebrow">Assistant</p>
              <h2>Lernassistent</h2>
            </div>
            {activeDoc && (
              <span className="assistant-panel__context">
                {isExplaining ? 'Zitat wird erklaert...' : activeDoc.title}
              </span>
            )}
          </div>

          {!activeDocument ? (
            <div className="assistant-empty">
              <FileText size={42} />
              <h3>Bereit zum Lernen</h3>
              <p>
                Lade zuerst ein Dokument hoch. Danach kannst du Fragen stellen oder
                markierte Textstellen erklaeren lassen.
              </p>
              <button
                type="button"
                className="assistant-empty__button"
                onClick={() => hiddenUploadRef.current?.openFilePicker()}
              >
                Dokument hochladen
              </button>
            </div>
          ) : (
            <ChatInterface
              ref={chatInterfaceRef}
              documentId={activeDoc?.documentId || activeDocument}
              queuedUserMessage={queuedMessage || undefined}
              onQueueConsumed={handleQueueConsumed}
            />
          )}
        </section>
      </div>

      <style jsx>{`
        .app-shell {
          min-height: 100vh;
          display: grid;
          grid-template-columns: minmax(0, 1.45fr) minmax(360px, 0.92fr);
          gap: 18px;
          padding: 18px;
          background:
            radial-gradient(circle at top left, rgba(255, 255, 255, 0.75), transparent 34%),
            linear-gradient(180deg, #f3f0ea 0%, #e8e4dc 100%);
        }

        .workspace-panel,
        .assistant-panel {
          min-width: 0;
          min-height: calc(100vh - 36px);
          border-radius: 24px;
          overflow: hidden;
          border: 1px solid rgba(36, 30, 18, 0.12);
          box-shadow: 0 24px 48px rgba(63, 49, 26, 0.08);
          background: rgba(252, 250, 245, 0.92);
          backdrop-filter: blur(18px);
        }

        .workspace-panel {
          display: flex;
          flex-direction: column;
        }

        .workspace-chrome {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 18px 22px 14px;
          border-bottom: 1px solid rgba(36, 30, 18, 0.12);
          background: rgba(250, 248, 243, 0.95);
        }

        .workspace-nav,
        .workspace-tools {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .workspace-nav {
          flex: 1;
        }

        .workspace-tabs {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
          overflow-x: auto;
          padding-bottom: 2px;
        }

        .workspace-tabs::-webkit-scrollbar {
          height: 6px;
        }

        .workspace-tabs::-webkit-scrollbar-thumb {
          background: rgba(36, 30, 18, 0.16);
          border-radius: 999px;
        }

        .workspace-icon-button,
        .workspace-tab,
        .workspace-toggle {
          border: 1px solid rgba(36, 30, 18, 0.14);
          background: rgba(255, 255, 255, 0.7);
          color: #2d2a26;
          border-radius: 999px;
          transition: transform 0.16s ease, background 0.16s ease, border-color 0.16s ease;
        }

        .workspace-icon-button {
          width: 38px;
          height: 38px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .workspace-icon-button:hover:not(:disabled),
        .workspace-tab:hover,
        .workspace-toggle:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.92);
          border-color: rgba(36, 30, 18, 0.24);
          transform: translateY(-1px);
        }

        .workspace-icon-button:disabled,
        .workspace-toggle:disabled {
          opacity: 0.42;
          cursor: not-allowed;
          transform: none;
        }

        .workspace-tab {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 10px 16px;
          cursor: pointer;
          white-space: nowrap;
          min-width: 0;
        }

        .workspace-tab.active {
          background: #d8d4cf;
          border-color: rgba(36, 30, 18, 0.2);
        }

        .workspace-tab--empty {
          cursor: default;
          color: #7b7366;
        }

        .workspace-tab__dot {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          background: #e06b62;
          flex-shrink: 0;
        }

        .workspace-tab__label {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          font-size: 0.95rem;
        }

        .workspace-toggle {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          font-size: 0.95rem;
          cursor: pointer;
        }

        .workspace-toggle.summary-active {
          background: #ffffff;
        }

        .workspace-toggle__spinner {
          width: 14px;
          height: 14px;
          border-radius: 999px;
          border: 2px solid rgba(36, 30, 18, 0.2);
          border-top-color: #2d2a26;
          animation: spin 0.8s linear infinite;
        }

        .workspace-menu {
          position: relative;
        }

        .workspace-menu__content {
          position: absolute;
          top: calc(100% + 10px);
          right: 0;
          min-width: 220px;
          padding: 10px;
          border-radius: 16px;
          border: 1px solid rgba(36, 30, 18, 0.12);
          background: rgba(255, 255, 255, 0.96);
          box-shadow: 0 22px 38px rgba(52, 41, 20, 0.14);
          display: flex;
          flex-direction: column;
          gap: 4px;
          z-index: 25;
        }

        .workspace-menu__item {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border: none;
          border-radius: 12px;
          background: transparent;
          color: #2d2a26;
          font-size: 0.92rem;
          cursor: pointer;
          text-align: left;
        }

        .workspace-menu__item:hover:not(:disabled) {
          background: rgba(0, 0, 0, 0.04);
        }

        .workspace-menu__item:disabled {
          color: #a59d90;
          cursor: not-allowed;
        }

        .workspace-menu__item--danger {
          color: #9b3f37;
        }

        .workspace-canvas {
          flex: 1;
          min-height: 0;
          background: linear-gradient(180deg, rgba(244, 241, 235, 0.9), rgba(239, 235, 228, 0.86));
        }

        .workspace-empty {
          height: 100%;
          display: grid;
          align-items: center;
          grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
          gap: 28px;
          padding: 48px;
        }

        .workspace-empty__intro {
          max-width: 420px;
        }

        .workspace-empty__eyebrow,
        .assistant-panel__eyebrow {
          display: inline-block;
          margin-bottom: 14px;
          font-size: 0.76rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #8b8376;
        }

        .workspace-empty h1 {
          margin: 0 0 14px;
          font-size: clamp(2rem, 3vw, 3.2rem);
          line-height: 1.03;
          color: #26221c;
        }

        .workspace-empty p {
          margin: 0;
          font-size: 1rem;
          line-height: 1.75;
          color: #595247;
        }

        .workspace-empty__dropzone {
          min-width: 0;
        }

        .workspace-empty__error {
          grid-column: 1 / -1;
          color: #b23d35;
          font-size: 0.92rem;
          margin: 0;
        }

        .assistant-panel {
          display: flex;
          flex-direction: column;
          background: linear-gradient(180deg, rgba(18, 18, 20, 0.96), rgba(12, 12, 14, 0.98));
          border-color: rgba(255, 255, 255, 0.06);
        }

        .assistant-panel__header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
          padding: 22px 22px 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .assistant-panel__header h2 {
          margin: 0;
          color: #f8f7f4;
          font-size: 1.05rem;
        }

        .assistant-panel__context {
          padding: 8px 12px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.06);
          color: #b8b1a6;
          font-size: 0.78rem;
          max-width: 220px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .assistant-empty {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 14px;
          padding: 36px;
          text-align: center;
          color: #c6c1b8;
        }

        .assistant-empty h3 {
          margin: 0;
          font-size: 1.2rem;
          color: #f5f4ef;
        }

        .assistant-empty p {
          max-width: 280px;
          margin: 0;
          line-height: 1.6;
          color: #9f998e;
        }

        .assistant-empty__button {
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: rgba(255, 255, 255, 0.08);
          color: #f5f4ef;
          border-radius: 999px;
          padding: 10px 18px;
          cursor: pointer;
        }

        .assistant-empty__button:hover {
          background: rgba(255, 255, 255, 0.12);
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 1180px) {
          .app-shell {
            grid-template-columns: minmax(0, 1fr);
          }

          .workspace-panel,
          .assistant-panel {
            min-height: auto;
          }

          .workspace-empty {
            grid-template-columns: 1fr;
            padding: 34px 24px;
          }
        }

        @media (max-width: 768px) {
          .app-shell {
            padding: 12px;
            gap: 12px;
          }

          .workspace-chrome {
            flex-direction: column;
            align-items: stretch;
            padding: 16px;
          }

          .workspace-nav,
          .workspace-tools {
            width: 100%;
          }

          .workspace-tabs {
            flex: 1;
          }

          .workspace-tools {
            justify-content: space-between;
          }

          .assistant-panel__header {
            padding: 18px 16px 14px;
          }
        }
      `}</style>
    </>
  );
};

export default Home;
