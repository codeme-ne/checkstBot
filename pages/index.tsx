
import type { NextPage } from 'next';
import { useState, useEffect, useRef, useCallback } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import ChatInterface, { ChatInterfaceHandle } from '../components/ChatInterface';
import FileUpload, { FileUploadHandle } from '../components/FileUpload';
import EnhancedDocumentViewer from '../components/EnhancedDocumentViewer';

// Type definitions
interface Document {
  id: string;
  title: string;
  content: string;
  type: string;
  uploadDate: string;
  file?: File;
}

const MAX_EXPLAIN_SELECTION_CHARS = 2000;

const Home: NextPage = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [activeDocument, setActiveDocument] = useState<string | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const [highlightMode, setHighlightMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [queuedMessage, setQueuedMessage] = useState<string | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);
  const chatInterfaceRef = useRef<ChatInterfaceHandle>(null);
  const uploadDropzoneRef = useRef<FileUploadHandle>(null);

  // Load documents from localStorage on mount
  useEffect(() => {
    try {
      const savedDocs = localStorage.getItem('chat_documents');
      if (savedDocs) {
        const parsedDocs = JSON.parse(savedDocs);
        setDocuments(parsedDocs);
        if (parsedDocs.length > 0) {
          setActiveDocument((current) => current ?? parsedDocs[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to load documents from storage', error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle explanation requests from document viewer
  const handleExplainText = (text: string) => {
    const normalizedText = text.replace(/\s+/g, ' ').trim();
    const explainText = normalizedText.length > MAX_EXPLAIN_SELECTION_CHARS
      ? `${normalizedText.slice(0, MAX_EXPLAIN_SELECTION_CHARS)}...`
      : normalizedText;
    const message = `Bitte erkläre dieses Zitat präzise und verständlich:\n\n"${explainText}"`;
    setQueuedMessage(message);
    setIsExplaining(true);
    setSelectedText(''); // Clear selection to disable button
  };

  const handleQueueConsumed = () => {
    setQueuedMessage(null);
    // Reset explaining state after a short delay to allow for visual feedback
    setTimeout(() => setIsExplaining(false), 1000);
  };

  const activeDoc = documents.find(d => d.id === activeDocument);

  const renderMarkdown = (content: string) => {
    const html = marked(content);
    // Sanitize HTML to prevent XSS attacks
    const sanitized = typeof window !== 'undefined'
      ? DOMPurify.sanitize(html as string)
      : (html as string);
    return { __html: sanitized };
  }

  // Handle successful file upload
  const handleUploadComplete = (doc: { id: string; title: string; content?: string; file?: File }) => {
    const newDoc: Document = {
      id: doc.id, // Use document ID from API (filename)
      title: doc.title,
      content: doc.content || '[Content stored in vector database]',
      type: doc.file?.type || 'uploaded',
      uploadDate: new Date().toISOString(),
      file: doc.file,
    };

    // Update state and save to localStorage
    const updatedDocs = [...documents, newDoc];
    setDocuments(updatedDocs);
    setActiveDocument(newDoc.id);

    try {
      localStorage.setItem('chat_documents', JSON.stringify(updatedDocs));
    } catch (error) {
      console.error('Failed to save documents to storage', error);
    }

    setIsUploading(false);
    setUploadError(null);
  };

  // Handle document removal
  const handleRemoveDocument = (docId: string) => {
    const updatedDocs = documents.filter(d => d.id !== docId);
    setDocuments(updatedDocs);

    // Update active document if needed
    if (activeDocument === docId) {
      setActiveDocument(updatedDocs.length > 0 ? updatedDocs[0].id : null);
    }

    // Save to localStorage
    try {
      localStorage.setItem('chat_documents', JSON.stringify(updatedDocs));
    } catch (error) {
      console.error('Failed to save documents to storage', error);
    }
  };

  return (
    <>
      <div className="app-container">
        <div className="document-panel">
          <div className="panel-header">
            <h1>Dokumente</h1>
            <div className="document-actions">
              <FileUpload
                variant="button"
                onUploadComplete={handleUploadComplete}
                onUploadStart={() => setIsUploading(true)}
                onUploadError={(err) => {
                  setUploadError(err);
                  setIsUploading(false);
                }}
              />
              <input type="text" className="form-control search-input" placeholder="Im Dokument suchen..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
          </div>

          {documents.length === 0 ? (
            <div className="upload-zone-container">
              <FileUpload
                ref={uploadDropzoneRef}
                variant="dropzone"
                onUploadComplete={handleUploadComplete}
                onUploadStart={() => setIsUploading(true)}
                onUploadError={(err) => {
                  setUploadError(err);
                  setIsUploading(false);
                }}
              />
            </div>
          ) : (
            <>
              <div className="document-tabs">
                {documents.map(doc => (
                  <div key={doc.id} className={`document-tab ${doc.id === activeDocument ? 'active' : ''}`}>
                    <span onClick={() => setActiveDocument(doc.id)} style={{ cursor: 'pointer', flex: 1 }}>
                      {doc.title}
                    </span>
                    <button
                      className="tab-close"
                      title="Dokument schließen"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveDocument(doc.id);
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <div className="document-viewer">
                <EnhancedDocumentViewer
                  document={activeDoc || null}
                  onExplain={handleExplainText}
                />
              </div>
            </>
          )}

          {/* Status messages when documents are shown */}
          {documents.length > 0 && isUploading && (
            <div className="p-2 text-blue-600 text-center">Dokument wird verarbeitet...</div>
          )}
          {documents.length > 0 && uploadError && (
            <div className="p-2 text-red-500 text-center">{uploadError}</div>
          )}
        </div>

        <div className="chat-panel">
          <div className="panel-header">
            <h1>Lernassistent</h1>
          </div>

          {!activeDocument ? (
            <div className="chat-status">
              <div className="status-content">
                <svg className="status-icon" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden>
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                <h3>Bereit zum Lernen!</h3>
                <p>Laden Sie ein Dokument hoch, um mit dem intelligenten Lernen zu beginnen.</p>
                <button
                  type="button"
                  className="btn btn--primary status-cta"
                  onClick={() => uploadDropzoneRef.current?.openFilePicker()}
                  aria-label="Dokument hochladen"
                >
                  Dokument hochladen
                </button>
              </div>
            </div>
          ) : (
            <ChatInterface
              ref={chatInterfaceRef}
              documentId={activeDocument}
              queuedUserMessage={queuedMessage || undefined}
              onQueueConsumed={handleQueueConsumed}
            />
          )}
        </div>
      </div>
    </>
  );
};

export default Home;
