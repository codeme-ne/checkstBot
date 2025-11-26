import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
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

describe('ChatInterface', () => {
  beforeEach(() => {
    // Clear localStorage and mock DOM methods
    localStorage.clear();
    Element.prototype.scrollIntoView = jest.fn();
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
});