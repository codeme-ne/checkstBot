import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import FileUpload from '../../components/FileUpload';

describe('FileUpload', () => {
  it('renders upload button', () => {
    render(<FileUpload onUploadComplete={jest.fn()} />);
    expect(screen.getByRole('button', { name: /Datei hochladen/i })).toBeInTheDocument();
  });

  it('renders upload zone when no files are uploaded', () => {
    render(<FileUpload onUploadComplete={jest.fn()} variant="dropzone" />);
    expect(screen.getByText(/Dokument hier ablegen/i)).toBeInTheDocument();
    expect(screen.getByText(/PDF, DOCX, TXT, MD/i)).toBeInTheDocument();
  });

  it('accepts PDF, DOCX, TXT, and MD files', () => {
    render(<FileUpload onUploadComplete={jest.fn()} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toHaveAttribute('accept', '.pdf,.docx,.txt,.md');
  });

  it('validates file size (max 4MB)', async () => {
    const onError = jest.fn();
    render(<FileUpload onUploadComplete={jest.fn()} onUploadError={onError} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const largeFile = new File(['x'.repeat(5 * 1024 * 1024)], 'large.pdf', { type: 'application/pdf' });

    Object.defineProperty(input, 'files', {
      value: [largeFile],
      writable: false,
    });

    fireEvent.change(input);

    // Should trigger error callback for large file
    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(expect.stringMatching(/zu groß|too large/i));
    }, { timeout: 1000 });
  });
});
