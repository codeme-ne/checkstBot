import { render, screen, fireEvent } from '@testing-library/react';
import Home from '../pages/index';

const mockUploads = [
  { id: 'shared-backend-id', title: 'Erstes PDF', content: 'Erster Inhalt' },
  { id: 'shared-backend-id', title: 'Zweites PDF', content: 'Zweiter Inhalt' },
];

jest.mock('../components/FileUpload', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: React.forwardRef(function MockFileUpload(props: { onUploadComplete: (document: { id: string; title: string; content?: string }) => void }, _ref: unknown) {
      return (
        <button
          type="button"
          onClick={() => {
            const nextUpload = mockUploads.shift();
            if (nextUpload) {
              props.onUploadComplete(nextUpload);
            }
          }}
        >
          Mock Upload
        </button>
      );
    })
  };
});

jest.mock('../components/ChatInterface', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: React.forwardRef(function MockChatInterface(
      { documentId }: { documentId: string },
      _ref: unknown
    ) {
      return <div data-testid="chat-document-id">{documentId}</div>;
    }),
  };
});

describe('Home', () => {
  beforeEach(() => {
    mockUploads.splice(0, mockUploads.length,
      { id: 'shared-backend-id', title: 'Erstes PDF', content: 'Erster Inhalt' },
      { id: 'shared-backend-id', title: 'Zweites PDF', content: 'Zweiter Inhalt' }
    );
    localStorage.clear();
  });

  it('renders the main heading', () => {
    render(<Home />);
    const heading = screen.getByRole('heading', { level: 1, name: /Lernassistent/i });
    expect(heading).toBeInTheDocument();
  });

  it('closes only the selected document when uploads share the same backend id', () => {
    render(<Home />);

    const uploadButtons = screen.getAllByRole('button', { name: /mock upload/i });
    fireEvent.click(uploadButtons[0]);

    const updatedUploadButtons = screen.getAllByRole('button', { name: /mock upload/i });
    fireEvent.click(updatedUploadButtons[0]);

    expect(screen.getAllByText('Erstes PDF').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Zweites PDF').length).toBeGreaterThan(0);
    expect(screen.getByTestId('chat-document-id')).toHaveTextContent('shared-backend-id');

    const closeButtons = screen.getAllByTitle('Dokument schließen');
    fireEvent.click(closeButtons[1]);

    expect(screen.getAllByText('Erstes PDF').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('Zweites PDF')).toHaveLength(0);
    expect(screen.getByTestId('chat-document-id')).toHaveTextContent('shared-backend-id');
  });
});
