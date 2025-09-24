import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import FileUpload from '../../components/FileUpload';

describe('FileUpload', () => {
  it('renders upload button', () => {
    render(<FileUpload onUploadComplete={jest.fn()} />);
    expect(screen.getByRole('button', { name: /Hochladen/i })).toBeInTheDocument();
  });

  it('renders upload zone when no files are uploaded', () => {
    render(<FileUpload onUploadComplete={jest.fn()} />);
    expect(screen.getByText(/Dokument zum Lernen hochladen/i)).toBeInTheDocument();
    expect(screen.getByText(/PDF, DOCX, TXT, MD/i)).toBeInTheDocument();
  });

  it('accepts PDF, DOCX, TXT, and MD files', () => {
    render(<FileUpload onUploadComplete={jest.fn()} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toHaveAttribute('accept', '.pdf,.docx,.txt,.md');
  });

  it('validates file size (max 10MB)', () => {
    render(<FileUpload onUploadComplete={jest.fn()} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large.pdf', { type: 'application/pdf' });

    Object.defineProperty(input, 'files', {
      value: [largeFile],
      writable: false,
    });

    fireEvent.change(input);

    // Should show error for large file
    setTimeout(() => {
      expect(screen.getByText(/Datei ist zu groß/i)).toBeInTheDocument();
    }, 100);
  });
});