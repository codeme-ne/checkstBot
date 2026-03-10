import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PDFViewer from '../../components/PDFViewer';

const pageTextsForAssertions = [
  'introduction to the document',
  'gravity and motion are explained here',
  'motion is revisited in the appendix',
];

jest.mock('react-pdf', () => {
  const React = require('react');
  const mockPageTexts = [
    'introduction to the document',
    'gravity and motion are explained here',
    'motion is revisited in the appendix',
  ];

  const mockLoadedDocument = {
    numPages: mockPageTexts.length,
    getPage: async (pageNumber: number) => ({
      getTextContent: async () => ({
        items: mockPageTexts[pageNumber - 1].split(' ').map((part) => ({ str: part })),
      }),
    }),
  };

  return {
    Document: ({ onLoadSuccess, children }: { onLoadSuccess?: (document: any) => void; children: React.ReactNode }) => {
      const hasResolvedRef = React.useRef(false);
      if (!hasResolvedRef.current) {
        hasResolvedRef.current = true;
        void Promise.resolve().then(() => onLoadSuccess?.(mockLoadedDocument));
      }

      return <div>{children}</div>;
    },
    Page: ({ pageNumber, className }: { pageNumber: number; className?: string }) => (
      <div className={className}>
        <div className="react-pdf__Page__textContent">
          <span>{mockPageTexts[pageNumber - 1]}</span>
        </div>
        <div data-testid="current-page">{pageNumber}</div>
      </div>
    ),
    pdfjs: {
      version: '5.3.93',
      GlobalWorkerOptions: {
        workerSrc: '',
      },
    },
  };
});

describe('PDFViewer', () => {
  it('configures a bundled PDF.js worker asset instead of the deleted API route', () => {
    let workerSrc = '';

    jest.isolateModules(() => {
      const { pdfjs } = require('react-pdf');
      require('../../components/PDFViewer');
      workerSrc = pdfjs.GlobalWorkerOptions.workerSrc;
    });

    expect(workerSrc).toContain('pdf.worker.min.mjs');
    expect(workerSrc).not.toContain('/api/pdf-worker');
  });

  it('supports find-in-pdf navigation and highlights the current page match', async () => {
    render(<PDFViewer file={new File(['mock pdf'], 'sample.pdf', { type: 'application/pdf' })} />);

    await waitFor(() => {
      expect(screen.getByText('/ 3')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId('pdf-search-input'), { target: { value: 'motion' } });

    await waitFor(() => {
      expect(screen.getByTestId('pdf-search-count')).toHaveTextContent('1 / 2');
      expect(screen.getByTestId('current-page')).toHaveTextContent('2');
    });

    await waitFor(() => {
      expect(screen.getByText(pageTextsForAssertions[1])).toHaveAttribute('data-search-hit', 'true');
      expect(screen.getByText(pageTextsForAssertions[1])).toHaveAttribute('data-search-active', 'true');
    });

    fireEvent.click(screen.getByRole('button', { name: /Naechster Treffer/i }));

    await waitFor(() => {
      expect(screen.getByTestId('pdf-search-count')).toHaveTextContent('2 / 2');
      expect(screen.getByTestId('current-page')).toHaveTextContent('3');
    });
  });

  it('updates zoom and page navigation controls', async () => {
    render(<PDFViewer file={new File(['mock pdf'], 'sample.pdf', { type: 'application/pdf' })} />);

    await waitFor(() => {
      expect(screen.getByText('/ 3')).toBeInTheDocument();
      expect(screen.getByTestId('current-page')).toHaveTextContent('1');
    });

    fireEvent.click(screen.getByRole('button', { name: /Naechste Seite/i }));
    await waitFor(() => {
      expect(screen.getByTestId('current-page')).toHaveTextContent('2');
    });

    fireEvent.click(screen.getByRole('button', { name: /Vergroessern/i }));
    expect(screen.getByRole('button', { name: '115%' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '115%' }));
    expect(screen.getByRole('button', { name: '100%' })).toBeInTheDocument();
  });
});
