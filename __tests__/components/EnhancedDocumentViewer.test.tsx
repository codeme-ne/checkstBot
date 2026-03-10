import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import EnhancedDocumentViewer from '../../components/EnhancedDocumentViewer';

jest.mock('next/dynamic', () => {
  const React = require('react');

  return () =>
    function MockPDFViewer() {
      return (
        <div data-testid="mock-pdf-viewer">
          <p>This PDF explains gravity and motion clearly.</p>
        </div>
      );
    };
});

const createRect = (left: number, top: number, width: number, height: number): DOMRect =>
  ({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect);

const documentFixture = {
  id: 'doc-1',
  title: 'Sample PDF',
  content: '[Content stored in vector database]',
  type: 'application/pdf',
  uploadDate: '2026-03-09T00:00:00.000Z',
  file: new File(['mock pdf'], 'sample.pdf', { type: 'application/pdf' }),
};

describe('EnhancedDocumentViewer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('renders the PDF viewer when the selected document is a PDF', () => {
    render(
      <EnhancedDocumentViewer
        document={documentFixture}
        viewerMode="document"
        summaryState={{ status: 'idle' }}
        pdfViewerState={{ pageNumber: 1, scale: 1, searchQuery: '', activeMatchIndex: -1 }}
      />,
    );

    expect(screen.getByTestId('mock-pdf-viewer')).toBeInTheDocument();
  });

  it('shows the explain tooltip for selected PDF text and forwards the exact selection', () => {
    const onExplain = jest.fn();
    const removeAllRanges = jest.fn();

    jest.spyOn(window, 'getSelection').mockReturnValue({
      rangeCount: 1,
      toString: () => 'gravity and motion',
      getRangeAt: () => ({
        getBoundingClientRect: () => createRect(48, 96, 120, 24),
      }),
      removeAllRanges,
    } as unknown as Selection);

    const { container } = render(
      <EnhancedDocumentViewer
        document={documentFixture}
        viewerMode="document"
        summaryState={{ status: 'idle' }}
        pdfViewerState={{ pageNumber: 1, scale: 1, searchQuery: '', activeMatchIndex: -1 }}
        onExplain={onExplain}
      />,
    );

    const viewerBody = container.querySelector('.document-body') as HTMLDivElement;
    viewerBody.getBoundingClientRect = jest.fn(() => createRect(0, 0, 640, 480));

    fireEvent.mouseUp(document);

    act(() => {
      jest.advanceTimersByTime(20);
    });

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Erkl/i }));

    expect(onExplain).toHaveBeenCalledWith('gravity and motion');
    expect(removeAllRanges).toHaveBeenCalled();
  });

  it('renders the OTIO-style summary reader when summary mode is active', () => {
    render(
      <EnhancedDocumentViewer
        document={{
          ...documentFixture,
          file: undefined,
          content: '## Kernthema\n- Punkt eins\n- Punkt zwei',
        }}
        viewerMode="summary"
        summaryState={{
          status: 'ready',
          markdown: '## Kernthema\n- Punkt eins\n- Punkt zwei',
          generatedAt: '2026-03-10T08:00:00.000Z',
        }}
        pdfViewerState={{ pageNumber: 1, scale: 1, searchQuery: '', activeMatchIndex: -1 }}
      />,
    );

    expect(screen.getByTestId('document-summary')).toBeInTheDocument();
    expect(screen.getByText(/Original Summary/i)).toBeInTheDocument();
    expect(screen.getByText(/Kernthema/)).toBeInTheDocument();
  });
});
