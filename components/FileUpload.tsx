import React, { useRef, useState, useEffect } from 'react';
import { fetchCSRFToken } from '../lib/csrf-client';
import { showToast } from './Toast';

interface FileUploadProps {
  onUploadComplete: (document: { id: string; title: string }) => void;
  onUploadStart?: () => void;
  onUploadError?: (error: string) => void;
  variant?: 'button' | 'dropzone';
}

const FileUpload: React.FC<FileUploadProps> = ({
  onUploadComplete,
  onUploadStart,
  onUploadError,
  variant = 'button'
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [csrfToken, setCsrfToken] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    fetchCSRFToken().then(token => {
      setCsrfToken(token);
    });
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processFile(file);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const processFile = async (file: File) => {
    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      const errorMsg = 'Datei ist zu groß. Maximale Größe: 10MB';
      setError(errorMsg);
      showToast(errorMsg, 'error');
      return;
    }

    setError(null);
    setIsUploading(true);
    onUploadStart?.();

    // Fetch fresh CSRF token for each upload
    const freshToken = await fetchCSRFToken();

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'X-CSRF-Token': freshToken
        },
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        const errorMessage = data.error || 'Upload failed';
        throw new Error(errorMessage);
      }

      if (data.success && data.document) {
        onUploadComplete(data.document);
        setError(null);
        showToast(`${file.name} erfolgreich hochgeladen!`, 'success');
      }
    } catch (error) {
      console.error('Upload error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Fehler beim Hochladen der Datei';
      setError(errorMessage);
      onUploadError?.(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  if (variant === 'button') {
    return (
      <>
        <button
          className="upload-button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? (
            <div className="upload-loading" />
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          )}
          <span>{isUploading ? 'Wird hochgeladen...' : 'Datei hochladen'}</span>
        </button>
        <input
          type="file"
          ref={fileInputRef}
          accept=".pdf,.docx,.txt,.md"
          style={{ display: 'none' }}
          onChange={handleFileUpload}
        />

        <style jsx>{`
          .upload-button {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.625rem 1rem;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 0.875rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
          }

          .upload-button:hover:not(:disabled) {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
          }

          .upload-button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          .upload-loading {
            width: 20px;
            height: 20px;
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-top-color: white;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }

          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </>
    );
  }

  return (
    <>
      <div
        className={`upload-dropzone ${isDragging ? 'dragging' : ''} ${isUploading ? 'uploading' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
      >
        <div className="dropzone-content">
          {isUploading ? (
            <>
              <div className="upload-spinner" />
              <h3>Dokument wird verarbeitet...</h3>
              <p>Bitte warten Sie einen Moment</p>
            </>
          ) : (
            <>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              <h3>Dokument hier ablegen</h3>
              <p>oder klicken Sie zum Auswählen</p>
              <span className="file-types">PDF, DOCX, TXT, MD • Max 10MB</span>
            </>
          )}
          {error && (
            <div className="error-badge">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}
        </div>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        accept=".pdf,.docx,.txt,.md"
        style={{ display: 'none' }}
        onChange={handleFileUpload}
      />

      <style jsx>{`
        .upload-dropzone {
          position: relative;
          border: 2px dashed #e5e5e7;
          border-radius: 12px;
          padding: 3rem 2rem;
          text-align: center;
          cursor: pointer;
          transition: all 0.3s;
          background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
        }

        .upload-dropzone:hover:not(.uploading) {
          border-color: #667eea;
          background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);
        }

        .upload-dropzone.dragging {
          border-color: #667eea;
          background: linear-gradient(135deg, #667eea25 0%, #764ba225 100%);
          transform: scale(1.02);
        }

        .upload-dropzone.uploading {
          cursor: default;
        }

        .dropzone-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
        }

        .dropzone-content svg {
          color: #667eea;
          opacity: 0.7;
        }

        .dropzone-content h3 {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 600;
          color: #1a1a1a;
        }

        .dropzone-content p {
          margin: 0;
          color: #666;
          font-size: 0.875rem;
        }

        .file-types {
          display: inline-block;
          padding: 0.375rem 0.75rem;
          background: white;
          border-radius: 20px;
          font-size: 0.75rem;
          color: #666;
          margin-top: 0.5rem;
        }

        .upload-spinner {
          width: 64px;
          height: 64px;
          border: 3px solid rgba(102, 126, 234, 0.2);
          border-top-color: #667eea;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        .error-badge {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          background: #fee;
          border-radius: 8px;
          color: #c00;
          font-size: 0.875rem;
          margin-top: 1rem;
        }

        .error-badge svg {
          color: #c00;
          opacity: 1;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
};

export default FileUpload;