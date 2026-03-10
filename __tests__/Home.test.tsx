import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Home from '../pages/index';

const createDefaultUploads = () => [
  {
    id: 'backend-doc-1',
    title: 'Erstes PDF',
    content: 'Dies ist der erste Dokumentinhalt. Er ist lang genug fuer eine Zusammenfassung.',
  },
  {
    id: 'backend-doc-2',
    title: 'Zweites PDF',
    content: 'Dies ist der zweite Dokumentinhalt. Er ist ebenfalls lang genug fuer eine Zusammenfassung.',
  },
];

let mockUploads = createDefaultUploads();

jest.mock('../lib/csrf-client', () => ({
  fetchCSRFToken: jest.fn().mockResolvedValue('csrf-token'),
}));

jest.mock('../components/FileUpload', () => {
  const React = require('react');

  return {
    __esModule: true,
    default: React.forwardRef(function MockFileUpload(
      props: {
        variant?: 'button' | 'dropzone' | 'hidden';
        onUploadComplete: (document: { id: string; title: string; content?: string }) => void;
      },
      ref: React.Ref<{ openFilePicker: () => void }>,
    ) {
      const triggerUpload = () => {
        const nextUpload = mockUploads.shift();
        if (nextUpload) {
          props.onUploadComplete(nextUpload);
        }
      };

      React.useImperativeHandle(ref, () => ({
        openFilePicker: triggerUpload,
      }));

      if (props.variant === 'hidden') {
        return null;
      }

      return (
        <button
          type="button"
          onClick={triggerUpload}
        >
          Mock Upload
        </button>
      );
    }),
  };
});

jest.mock('../components/ChatInterface', () => {
  const React = require('react');

  return {
    __esModule: true,
    default: React.forwardRef(function MockChatInterface(
      { documentId }: { documentId: string },
      _ref: unknown,
    ) {
      return <div data-testid="chat-document-id">{documentId}</div>;
    }),
  };
});

describe('Home', () => {
  beforeEach(() => {
    mockUploads = createDefaultUploads();
    localStorage.clear();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('renders the main assistant heading', () => {
    render(<Home />);
    expect(screen.getByRole('heading', { level: 2, name: /Lernassistent/i })).toBeInTheDocument();
  });

  it('loads a summary once and toggles back to content without refetching', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        summary: '## Kernaussagen\n- Punkt eins\n- Punkt zwei',
        generatedAt: '2026-03-10T09:30:00.000Z',
      }),
    });

    render(<Home />);

    fireEvent.click(screen.getByRole('button', { name: /Mock Upload/i }));

    fireEvent.click(screen.getByRole('button', { name: /Summary/i }));

    await waitFor(() => {
      expect(screen.getByTestId('document-summary')).toBeInTheDocument();
      expect(screen.getByText(/Original Summary/i)).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Content/i }));
    expect(screen.queryByTestId('document-summary')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Summary/i }));
    await waitFor(() => {
      expect(screen.getByTestId('document-summary')).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('switches back to the previously active document and closes only the active tab', async () => {
    render(<Home />);

    fireEvent.click(screen.getByRole('button', { name: /Mock Upload/i }));
    fireEvent.click(screen.getByRole('button', { name: /Dokument hochladen/i }));

    expect(screen.getByTestId('chat-document-id')).toHaveTextContent('backend-doc-2');

    fireEvent.click(screen.getByRole('button', { name: /Vorheriges Dokument/i }));
    await waitFor(() => {
      expect(screen.getByTestId('chat-document-id')).toHaveTextContent('backend-doc-1');
    });

    fireEvent.click(screen.getByRole('tab', { name: /Zweites PDF/i }));
    fireEvent.click(screen.getByRole('button', { name: /Dokumentaktionen/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Dokument schliessen/i }));

    await waitFor(() => {
      expect(screen.queryByRole('tab', { name: /Zweites PDF/i })).not.toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Erstes PDF/i })).toBeInTheDocument();
      expect(screen.getByTestId('chat-document-id')).toHaveTextContent('backend-doc-1');
    });
  });
});
