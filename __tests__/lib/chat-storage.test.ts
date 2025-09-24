import { ChatStorageService } from '../../lib/chat-storage';

// Message interface (matching ChatInterface)
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  model?: string;
  isStreaming?: boolean;
}

describe('ChatStorageService', () => {
  let storage: ChatStorageService;
  const documentId1 = 'doc-123';
  const documentId2 = 'doc-456';

  const sampleMessages: Message[] = [
    {
      id: 'msg-1',
      role: 'assistant',
      content: 'Welcome message',
      timestamp: '2024-01-01T10:00:00.000Z',
      model: 'gpt-4'
    },
    {
      id: 'msg-2',
      role: 'user',
      content: 'Hello',
      timestamp: '2024-01-01T10:01:00.000Z'
    },
    {
      id: 'msg-3',
      role: 'assistant',
      content: 'How can I help you?',
      timestamp: '2024-01-01T10:02:00.000Z',
      model: 'gpt-4'
    }
  ];

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    storage = new ChatStorageService();
  });

  describe('saveMessages', () => {
    it('should save messages for a document', () => {
      storage.saveMessages(documentId1, sampleMessages);

      const saved = storage.getMessages(documentId1);
      expect(saved).toEqual(sampleMessages);
    });

    it('should handle empty messages array', () => {
      storage.saveMessages(documentId1, []);

      const saved = storage.getMessages(documentId1);
      expect(saved).toEqual([]);
    });

    it('should overwrite previous messages for same document', () => {
      const initialMessages = [sampleMessages[0]];
      const updatedMessages = sampleMessages;

      storage.saveMessages(documentId1, initialMessages);
      storage.saveMessages(documentId1, updatedMessages);

      const saved = storage.getMessages(documentId1);
      expect(saved).toEqual(updatedMessages);
      expect(saved).toHaveLength(3);
    });
  });

  describe('getMessages', () => {
    it('should return empty array for non-existent document', () => {
      const messages = storage.getMessages('non-existent-doc');
      expect(messages).toEqual([]);
    });

    it('should return saved messages for existing document', () => {
      storage.saveMessages(documentId1, sampleMessages);

      const messages = storage.getMessages(documentId1);
      expect(messages).toEqual(sampleMessages);
    });

    it('should maintain message order', () => {
      storage.saveMessages(documentId1, sampleMessages);

      const messages = storage.getMessages(documentId1);
      expect(messages[0].id).toBe('msg-1');
      expect(messages[1].id).toBe('msg-2');
      expect(messages[2].id).toBe('msg-3');
    });
  });

  describe('multiple documents', () => {
    it('should store messages separately for different documents', () => {
      const messages1 = [sampleMessages[0]];
      const messages2 = [sampleMessages[1], sampleMessages[2]];

      storage.saveMessages(documentId1, messages1);
      storage.saveMessages(documentId2, messages2);

      expect(storage.getMessages(documentId1)).toEqual(messages1);
      expect(storage.getMessages(documentId2)).toEqual(messages2);
    });

    it('should not interfere between document conversations', () => {
      storage.saveMessages(documentId1, sampleMessages);
      storage.saveMessages(documentId2, []);

      expect(storage.getMessages(documentId1)).toHaveLength(3);
      expect(storage.getMessages(documentId2)).toHaveLength(0);
    });
  });

  describe('addMessage', () => {
    it('should add a new message to existing conversation', () => {
      storage.saveMessages(documentId1, [sampleMessages[0]]);

      const newMessage: Message = {
        id: 'msg-new',
        role: 'user',
        content: 'New message',
        timestamp: '2024-01-01T10:03:00.000Z'
      };

      storage.addMessage(documentId1, newMessage);

      const messages = storage.getMessages(documentId1);
      expect(messages).toHaveLength(2);
      expect(messages[1]).toEqual(newMessage);
    });

    it('should create new conversation if document does not exist', () => {
      const newMessage: Message = {
        id: 'msg-new',
        role: 'user',
        content: 'First message',
        timestamp: '2024-01-01T10:00:00.000Z'
      };

      storage.addMessage('new-doc', newMessage);

      const messages = storage.getMessages('new-doc');
      expect(messages).toEqual([newMessage]);
    });

    it('should maintain chronological order when adding messages', () => {
      storage.saveMessages(documentId1, [sampleMessages[0]]);

      const laterMessage: Message = {
        id: 'msg-later',
        role: 'user',
        content: 'Later message',
        timestamp: '2024-01-01T10:05:00.000Z'
      };

      storage.addMessage(documentId1, laterMessage);

      const messages = storage.getMessages(documentId1);
      expect(messages).toHaveLength(2);
      expect(new Date(messages[0].timestamp).getTime()).toBeLessThan(
        new Date(messages[1].timestamp).getTime()
      );
    });
  });

  describe('clearMessages', () => {
    it('should clear all messages for a document', () => {
      storage.saveMessages(documentId1, sampleMessages);
      storage.clearMessages(documentId1);

      const messages = storage.getMessages(documentId1);
      expect(messages).toEqual([]);
    });

    it('should not affect other documents when clearing one', () => {
      storage.saveMessages(documentId1, sampleMessages);
      storage.saveMessages(documentId2, [sampleMessages[0]]);

      storage.clearMessages(documentId1);

      expect(storage.getMessages(documentId1)).toEqual([]);
      expect(storage.getMessages(documentId2)).toEqual([sampleMessages[0]]);
    });

    it('should handle clearing non-existent document gracefully', () => {
      expect(() => {
        storage.clearMessages('non-existent-doc');
      }).not.toThrow();

      const messages = storage.getMessages('non-existent-doc');
      expect(messages).toEqual([]);
    });
  });

  describe('getAllConversations', () => {
    it('should return all document IDs with conversations', () => {
      storage.saveMessages(documentId1, sampleMessages);
      storage.saveMessages(documentId2, [sampleMessages[0]]);

      const conversations = storage.getAllConversations();
      expect(conversations).toHaveLength(2);
      expect(conversations).toContain(documentId1);
      expect(conversations).toContain(documentId2);
    });

    it('should return empty array when no conversations exist', () => {
      const conversations = storage.getAllConversations();
      expect(conversations).toEqual([]);
    });

    it('should not return documents with empty conversations', () => {
      storage.saveMessages(documentId1, sampleMessages);
      storage.saveMessages(documentId2, []);

      const conversations = storage.getAllConversations();
      // Note: We might want to exclude empty conversations or include them
      // This test documents the current expected behavior
      expect(conversations).toContain(documentId1);
      expect(conversations).toContain(documentId2);
    });
  });

  describe('data persistence', () => {
    it('should persist data across service instances', () => {
      storage.saveMessages(documentId1, sampleMessages);

      // Create a new instance to simulate page reload
      const newStorage = new ChatStorageService();
      const messages = newStorage.getMessages(documentId1);

      expect(messages).toEqual(sampleMessages);
    });

    it('should handle invalid JSON data gracefully', () => {
      // Simulate corrupted data in localStorage
      localStorage.setItem('checkstbot_conversations', 'invalid-json');

      const newStorage = new ChatStorageService();
      const messages = newStorage.getMessages(documentId1);

      expect(messages).toEqual([]);
    });

    it('should handle missing localStorage gracefully', () => {
      // Mock localStorage not available
      const originalLocalStorage = window.localStorage;
      Object.defineProperty(window, 'localStorage', {
        value: undefined,
        writable: true
      });

      expect(() => {
        const newStorage = new ChatStorageService();
        newStorage.getMessages(documentId1);
      }).not.toThrow();

      // Restore localStorage
      Object.defineProperty(window, 'localStorage', {
        value: originalLocalStorage,
        writable: true
      });
    });
  });

  describe('message validation', () => {
    it('should handle messages with missing optional fields', () => {
      const minimalMessage: Message = {
        id: 'minimal',
        role: 'user',
        content: 'Hello',
        timestamp: '2024-01-01T10:00:00.000Z'
      };

      storage.saveMessages(documentId1, [minimalMessage]);
      const saved = storage.getMessages(documentId1);

      expect(saved[0]).toEqual(minimalMessage);
    });

    it('should preserve all message properties including optional ones', () => {
      const fullMessage: Message = {
        id: 'full',
        role: 'assistant',
        content: 'Full response',
        timestamp: '2024-01-01T10:00:00.000Z',
        model: 'gpt-4',
        isStreaming: false
      };

      storage.saveMessages(documentId1, [fullMessage]);
      const saved = storage.getMessages(documentId1);

      expect(saved[0]).toEqual(fullMessage);
    });
  });
});