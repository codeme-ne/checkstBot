import React, { useRef, useState, useEffect, useCallback, useId, forwardRef, useImperativeHandle } from 'react';
import { fetchCSRFToken } from '../lib/csrf-client';
import { showToast } from './Toast';

interface FileUploadProps {
  onUploadComplete: (document: { id: string; title: string; file?: File }) => void;
  onUploadStart?: () => void;
  onUploadError?: (error: string) => void;
  variant?: 'button' | 'dropzone';
}

export interface FileUploadHandle {
  openFilePicker: () => void;
}

const MAX_UPLOAD_SIZE = parseInt(process.env.NEXT_PUBLIC_MAX_FILE_SIZE || '4194304', 10); // 4MB default

const FileUpload = forwardRef<FileUploadHandle, FileUploadProps>(({
  onUploadComplete,
  onUploadStart,
  onUploadError,
  variant = 'button'
}, ref) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputId = useId();

  const hiddenFileInputStyle: React.CSSProperties = {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: 0,
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    border: 0
  };

  useEffect(() => {
    fetchCSRFToken();
  }, []);

  const triggerFilePicker = useCallback(() => {
    if (isUploading) return;

    const input = fileInputRef.current;
    if (!input) {
      showToast('Dateiauswahl konnte nicht geöffnet werden. Bitte Seite neu laden.', 'error');
      return;
    }

    // Prefer the modern API when available and fall back to click()
    const pickerInput = input as HTMLInputElement & { showPicker?: () => void };
    if (typeof pickerInput.showPicker === 'function') {
      try {
        pickerInput.showPicker();
        return;
      } catch {
        // Browser may deny showPicker; fallback below.
      }
    }

    input.click();
  }, [isUploading]);

  // Stable click handler to prevent hydration issues
  const handleButtonClick = useCallback(() => {
    triggerFilePicker();
  }, [triggerFilePicker]);

  const handleDropzoneClick = useCallback(() => {
    triggerFilePicker();
  }, [triggerFilePicker]);

  useImperativeHandle(ref, () => ({
    openFilePicker: triggerFilePicker
  }), [triggerFilePicker]);

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
    // Validate file size client-side before upload
    if (file.size > MAX_UPLOAD_SIZE) {
      const maxSizeMb = (MAX_UPLOAD_SIZE / 1024 / 1024).toFixed(1);
      const errorMsg = `Datei ist zu groß. Maximale Größe: ${maxSizeMb}MB`;
      setError(errorMsg);
      onUploadError?.(errorMsg);
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

      const responseText = await res.text();
      let data: any = {};
      if (responseText) {
        try {
          data = JSON.parse(responseText);
        } catch {
          data = {};
        }
      }

      if (!res.ok) {
        const fallbackMessage = res.status === 413
          ? `Datei ist zu groß. Maximale Größe: ${(MAX_UPLOAD_SIZE / 1024 / 1024).toFixed(1)}MB`
          : `Upload fehlgeschlagen (HTTP ${res.status})`;
        const errorMessage = data.error || data.message || fallbackMessage;
        throw new Error(errorMessage);
      }

      if (data.success && data.document) {
        onUploadComplete({ ...data.document, file });
        setError(null);
        showToast(`${file.name} erfolgreich hochgeladen!`, 'success');
      } else {
        throw new Error('Ungültige Serverantwort beim Upload');
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
          type="button"
          className="upload-button"
          onClick={handleButtonClick}
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
          id={inputId}
          type="file"
          ref={fileInputRef}
          accept=".pdf,.docx,.txt,.md"
          style={hiddenFileInputStyle}
          onChange={handleFileUpload}
        />

        <style jsx>{`
          .upload-button {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem 0.875rem;
            background: rgba(50, 184, 198, 0.15);
            color: #32B8C6;
            border: 1px solid rgba(50, 184, 198, 0.3);
            border-radius: 6px;
            font-size: 0.8125rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
          }

          .upload-button:hover:not(:disabled) {
            background: rgba(50, 184, 198, 0.25);
            border-color: rgba(50, 184, 198, 0.5);
            box-shadow: 0 0 12px rgba(50, 184, 198, 0.2);
          }

          .upload-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          .upload-loading {
            width: 16px;
            height: 16px;
            border: 2px solid rgba(50, 184, 198, 0.3);
            border-top-color: #32B8C6;
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
        onClick={handleDropzoneClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleDropzoneClick();
          }
        }}
        role="button"
        tabIndex={0}
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
              <span className="file-types">PDF, DOCX, TXT, MD • Max {(MAX_UPLOAD_SIZE / 1024 / 1024).toFixed(1)}MB</span>
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
        id={inputId}
        type="file"
        ref={fileInputRef}
        accept=".pdf,.docx,.txt,.md"
        style={hiddenFileInputStyle}
        onChange={handleFileUpload}
      />

      <style jsx>{`
        .upload-dropzone {
          position: relative;
          border: 1px dashed rgba(255, 255, 255, 0.15);
          border-radius: 10px;
          padding: 2.5rem 2rem;
          text-align: center;
          cursor: pointer;
          transition: border-color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease;
          background: rgba(255, 255, 255, 0.02);
        }

        .upload-dropzone:hover:not(.uploading) {
          border-color: rgba(50, 184, 198, 0.4);
          background: rgba(50, 184, 198, 0.05);
        }

        .upload-dropzone.dragging {
          border-color: var(--color-primary);
          border-width: 2px;
          background: rgba(33, 128, 141, 0.12);
          box-shadow: 0 0 20px rgba(33, 128, 141, 0.2);
        }

        .upload-dropzone.uploading {
          cursor: default;
        }

        .dropzone-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.875rem;
        }

        .dropzone-content svg {
          color: #32B8C6;
          opacity: 0.6;
          width: 48px;
          height: 48px;
        }

        .dropzone-content h3 {
          margin: 0;
          font-size: 1rem;
          font-weight: 500;
          color: #f5f5f5;
        }

        .dropzone-content p {
          margin: 0;
          color: #71717a;
          font-size: 0.8125rem;
        }

        .file-types {
          display: inline-block;
          padding: 0.25rem 0.625rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 4px;
          font-size: 0.6875rem;
          color: #71717a;
          margin-top: 0.25rem;
        }

        .upload-spinner {
          width: 48px;
          height: 48px;
          border: 2px solid rgba(50, 184, 198, 0.2);
          border-top-color: #32B8C6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        .error-badge {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.875rem;
          background: rgba(255, 84, 89, 0.1);
          border: 1px solid rgba(255, 84, 89, 0.2);
          border-radius: 6px;
          color: #ff5459;
          font-size: 0.8125rem;
          margin-top: 0.75rem;
        }

        .error-badge svg {
          color: #ff5459;
          opacity: 1;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
});

FileUpload.displayName = 'FileUpload';

export default FileUpload;
