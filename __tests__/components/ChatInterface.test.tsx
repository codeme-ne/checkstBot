import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ChatInterface from '../../components/ChatInterface';

// Mock MessageBubble to avoid react-markdown issues in tests
jest.mock('../../components/MessageBubble', () => {
  return function MockMessageBubble({ role, content, timestamp }: any) {
    return (
      <div data-testid={`message-${role}`}>
        <span>{role === 'user' ? '👤 You' : '🤖 Assistant'}</span>
        <div>{content}</div>
        {timestamp && <time>{new Date(timestamp).toLocaleTimeString()}</time>}
      </div>
    );
  };
});

// Mock the CSRF module
jest.mock('../../lib/csrf-client', () => ({
  fetchCSRFToken: jest.fn().mockResolvedValue('mock-csrf-token'),
  getCSRFTokenFromCookie: jest.fn().mockReturnValue('mock-csrf-token')
}));

global.fetch = jest.fn();

describe('ChatInterface', () => {
  beforeEach(() => {
    // Clear localStorage and mock DOM methods
    localStorage.clear();
    Element.prototype.scrollIntoView = jest.fn();
    (global.fetch as jest.Mock).mockReset();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('renders chat interface with input and send button', () => {
    render(<ChatInterface documentId="test-doc" />);

    expect(screen.getByPlaceholderText(/Stellen Sie eine Frage zu Ihrem Dokument/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /nachricht senden/i })).toBeInTheDocument();
  });

  it('displays initial assistant message', () => {
    render(<ChatInterface documentId="test-doc" />);

    expect(screen.getByText(/Hallo! Ich bin Ihr intelligenter Lernassistent/i)).toBeInTheDocument();
  });

  it('disables send button when input is empty', () => {
    render(<ChatInterface documentId="test-doc" />);

    const sendButton = screen.getByRole('button', { name: /send/i });
    expect(sendButton).toBeDisabled();
  });

  it('enables send button when input has text', () => {
    render(<ChatInterface documentId="test-doc" />);

    const input = screen.getByPlaceholderText(/Stellen Sie eine Frage zu Ihrem Dokument/i);
    const sendButton = screen.getByRole('button', { name: /nachricht senden/i });

    fireEvent.change(input, { target: { value: 'Test question' } });
    expect(sendButton).not.toBeDisabled();
  });

  it('clears input after sending message', () => {
    render(<ChatInterface documentId="test-doc" />);

    const input = screen.getByPlaceholderText(/Stellen Sie eine Frage zu Ihrem Dokument/i) as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'Test question' } });
    fireEvent.click(screen.getByRole('button', { name: /nachricht senden/i }));

    expect(input.value).toBe('');
  });

  it('sends message on Enter key press', () => {
    render(<ChatInterface documentId="test-doc" />);

    const input = screen.getByPlaceholderText(/Stellen Sie eine Frage zu Ihrem Dokument/i);

    fireEvent.change(input, { target: { value: 'Test question' } });
    fireEvent.keyPress(input, { key: 'Enter', code: 'Enter', charCode: 13 });

    expect(screen.getByText('Test question')).toBeInTheDocument();
  });

  it('uses structured explain payloads for queued explain requests', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({ response: 'Erklärung aus dem Backend' }))
    });

    render(
      <ChatInterface
        documentId="test-doc"
        queuedUserMessage={{
          displayMessage: 'Erkläre bitte die markierte Stelle im Dokument.',
          explainSelection: {
            selectedText: 'lyses on acne vulgaris treatment effectiveness?',
            context: 'What are the largest systematic reviews or meta-analyses on acne vulgaris treatment effectiveness?'
          }
        } as any}
      />
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    const [, request] = (global.fetch as jest.Mock).mock.calls[0];
    const parsedBody = JSON.parse((request as RequestInit).body as string);

    expect(parsedBody.message).toBe('Erkläre bitte die markierte Stelle im Dokument.');
    expect(parsedBody.explainSelection).toEqual({
      selectedText: 'lyses on acne vulgaris treatment effectiveness?',
      context: 'What are the largest systematic reviews or meta-analyses on acne vulgaris treatment effectiveness?'
    });

    expect(
      screen.getByText('Erkläre bitte die markierte Stelle im Dokument.')
    ).toBeInTheDocument();
  });
});
