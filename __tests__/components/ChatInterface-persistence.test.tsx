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

// Mock the API response
const mockApiResponse = {
  response: 'This is a mocked AI response'
};

// Mock fetch globally
global.fetch = jest.fn();

describe('ChatInterface - Chat History Persistence', () => {
  const documentId1 = 'doc-123';
  const documentId2 = 'doc-456';

  beforeEach(() => {
    localStorage.clear();
    (global.fetch as jest.Mock).mockClear();

    // Mock DOM methods
    Element.prototype.scrollIntoView = jest.fn();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('message persistence', () => {
    it('should save messages to storage when user sends a message', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApiResponse)
      });

      render(<ChatInterface documentId={documentId1} />);

      const textarea = screen.getByRole('textbox');
      const sendButton = screen.getByRole('button', { name: /nachricht senden/i });

      // Send a message
      fireEvent.change(textarea, { target: { value: 'Hello' } });
      fireEvent.click(sendButton);

      // Wait for the AI response
      await waitFor(() => {
        expect(screen.getByText('This is a mocked AI response')).toBeInTheDocument();
      });

      // Check if messages are saved to localStorage
      const storageData = localStorage.getItem('checkstbot_conversations');
      expect(storageData).toBeTruthy();

      const conversations = JSON.parse(storageData!);
      expect(conversations[documentId1]).toBeDefined();
      expect(conversations[documentId1]).toHaveLength(3); // welcome + user + assistant

      // Check message contents
      const messages = conversations[documentId1];
      expect(messages[0].content).toContain('Hallo! Ich bin Ihr intelligenter Lernassistent');
      expect(messages[1].content).toBe('Hello');
      expect(messages[1].role).toBe('user');
      expect(messages[2].content).toBe('This is a mocked AI response');
      expect(messages[2].role).toBe('assistant');
    });

    it('should load existing messages when component mounts', () => {
      // Pre-populate localStorage with conversation data
      const existingMessages = [
        {
          id: 'welcome-message',
          role: 'assistant' as const,
          content: '👋 Hallo! Ich bin Ihr intelligenter Lernassistent. Stellen Sie mir gerne Fragen zu Ihrem Dokument!',
          timestamp: '2024-01-01T10:00:00.000Z',
          model: 'gpt-4'
        },
        {
          id: 'msg-1',
          role: 'user' as const,
          content: 'Previous message',
          timestamp: '2024-01-01T10:01:00.000Z'
        },
        {
          id: 'msg-2',
          role: 'assistant' as const,
          content: 'Previous response',
          timestamp: '2024-01-01T10:02:00.000Z',
          model: 'gpt-4'
        }
      ];

      localStorage.setItem('checkstbot_conversations', JSON.stringify({
        [documentId1]: existingMessages
      }));

      render(<ChatInterface documentId={documentId1} />);

      // Check that previous messages are displayed
      expect(screen.getByText('Previous message')).toBeInTheDocument();
      expect(screen.getByText('Previous response')).toBeInTheDocument();
    });

    it('should show only welcome message for new document with no history', () => {
      render(<ChatInterface documentId="new-document" />);

      // Should only show the welcome message
      expect(screen.getByText(/Hallo! Ich bin Ihr intelligenter Lernassistent/)).toBeInTheDocument();

      // Should not show any other messages
      const messageElements = screen.getAllByText(/👤|🤖/);
      expect(messageElements).toHaveLength(1); // Only the assistant welcome message
    });

    it('should maintain separate conversations for different documents', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApiResponse)
      });

      // First document conversation
      const { rerender } = render(<ChatInterface documentId={documentId1} />);

      const textarea = screen.getByRole('textbox');
      const sendButton = screen.getByRole('button', { name: /nachricht senden/i });

      fireEvent.change(textarea, { target: { value: 'Message for doc 1' } });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText('This is a mocked AI response')).toBeInTheDocument();
      });

      // Switch to second document
      rerender(<ChatInterface documentId={documentId2} />);

      // Should show only welcome message for new document
      expect(screen.getByText(/Hallo! Ich bin Ihr intelligenter Lernassistent/)).toBeInTheDocument();
      expect(screen.queryByText('Message for doc 1')).not.toBeInTheDocument();

      // Send message to second document
      fireEvent.change(textarea, { target: { value: 'Message for doc 2' } });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText('This is a mocked AI response')).toBeInTheDocument();
      });

      // Switch back to first document
      rerender(<ChatInterface documentId={documentId1} />);

      // Should show the previous conversation
      expect(screen.getByText('Message for doc 1')).toBeInTheDocument();
      expect(screen.queryByText('Message for doc 2')).not.toBeInTheDocument();

      // Check localStorage has both conversations
      const storageData = localStorage.getItem('checkstbot_conversations');
      const conversations = JSON.parse(storageData!);

      expect(conversations[documentId1]).toBeDefined();
      expect(conversations[documentId2]).toBeDefined();
      expect(conversations[documentId1]).toHaveLength(3); // welcome + user + assistant
      expect(conversations[documentId2]).toHaveLength(3); // welcome + user + assistant
    });

    it('should handle API errors gracefully and still persist messages', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('API Error'));

      render(<ChatInterface documentId={documentId1} />);

      const textarea = screen.getByRole('textbox');
      const sendButton = screen.getByRole('button', { name: /nachricht senden/i });

      fireEvent.change(textarea, { target: { value: 'Test message' } });
      fireEvent.click(sendButton);

      // Wait for error message
      await waitFor(() => {
        expect(screen.getByText(/Ein Fehler ist aufgetreten/)).toBeInTheDocument();
      });

      // Check that user message and error message are saved
      const storageData = localStorage.getItem('checkstbot_conversations');
      const conversations = JSON.parse(storageData!);

      expect(conversations[documentId1]).toHaveLength(3); // welcome + user + error
      expect(conversations[documentId1][1].content).toBe('Test message');
      expect(conversations[documentId1][1].role).toBe('user');
      expect(conversations[documentId1][2].content).toContain('Ein Fehler ist aufgetreten');
      expect(conversations[documentId1][2].role).toBe('assistant');
    });
  });

  describe('message ordering and timestamps', () => {
    it('should maintain chronological order of messages', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApiResponse)
      });

      render(<ChatInterface documentId={documentId1} />);

      const textarea = screen.getByRole('textbox');
      const sendButton = screen.getByRole('button', { name: /nachricht senden/i });

      // Send multiple messages
      fireEvent.change(textarea, { target: { value: 'First message' } });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText('This is a mocked AI response')).toBeInTheDocument();
      });

      fireEvent.change(textarea, { target: { value: 'Second message' } });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(screen.getAllByText('This is a mocked AI response')).toHaveLength(2);
      });

      // Check message order in storage
      const storageData = localStorage.getItem('checkstbot_conversations');
      const conversations = JSON.parse(storageData!);
      const messages = conversations[documentId1];

      expect(messages).toHaveLength(5); // welcome + user1 + ai1 + user2 + ai2

      // Verify chronological order by timestamps
      for (let i = 1; i < messages.length; i++) {
        const prevTime = new Date(messages[i - 1].timestamp).getTime();
        const currentTime = new Date(messages[i].timestamp).getTime();
        expect(currentTime).toBeGreaterThanOrEqual(prevTime);
      }
    });

    it('should assign unique IDs to all messages', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApiResponse)
      });

      render(<ChatInterface documentId={documentId1} />);

      const textarea = screen.getByRole('textbox');
      const sendButton = screen.getByRole('button', { name: /nachricht senden/i });

      fireEvent.change(textarea, { target: { value: 'Test message' } });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText('This is a mocked AI response')).toBeInTheDocument();
      });

      const storageData = localStorage.getItem('checkstbot_conversations');
      const conversations = JSON.parse(storageData!);
      const messages = conversations[documentId1];

      // Check that all messages have unique IDs
      const ids = messages.map((msg: any) => msg.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);

      // Check that all messages have valid IDs
      ids.forEach((id: string) => {
        expect(id).toBeTruthy();
        expect(typeof id).toBe('string');
      });
    });
  });

  describe('localStorage edge cases', () => {
    it('should handle localStorage being unavailable', () => {
      // Mock localStorage to throw errors
      const originalSetItem = localStorage.setItem;
      const originalGetItem = localStorage.getItem;

      localStorage.setItem = jest.fn(() => {
        throw new Error('localStorage not available');
      });
      localStorage.getItem = jest.fn(() => {
        throw new Error('localStorage not available');
      });

      // Should not crash
      expect(() => {
        render(<ChatInterface documentId={documentId1} />);
      }).not.toThrow();

      expect(screen.getByText(/Hallo! Ich bin Ihr intelligenter Lernassistent/)).toBeInTheDocument();

      // Restore original methods
      localStorage.setItem = originalSetItem;
      localStorage.getItem = originalGetItem;
    });

    it('should handle corrupted localStorage data', () => {
      // Set invalid JSON data
      localStorage.setItem('checkstbot_conversations', 'invalid-json-data');

      // Should not crash and should show welcome message
      expect(() => {
        render(<ChatInterface documentId={documentId1} />);
      }).not.toThrow();

      expect(screen.getByText(/Hallo! Ich bin Ihr intelligenter Lernassistent/)).toBeInTheDocument();
    });
  });
});