/**
 * Chat History Persistence Service
 *
 * Provides localStorage-based persistence for chat conversations per document.
 * Designed for learning context - students need their conversations to review
 * previous explanations and build knowledge over time.
 *
 * Key features:
 * - Document-scoped conversations
 * - Offline persistence via localStorage
 * - Graceful fallback when storage unavailable
 * - Maintains chronological message order
 */

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  model?: string;
  isStreaming?: boolean;
  sources?: string[];
}

interface ConversationData {
  [documentId: string]: Message[];
}

const STORAGE_KEY = 'checkstbot_conversations';

export class ChatStorageService {
  private isStorageAvailable: boolean;

  constructor() {
    this.isStorageAvailable = this.checkStorageAvailable();
  }

  /**
   * Check if localStorage is available
   */
  private checkStorageAvailable(): boolean {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return false;
      }
      // Test if we can actually write to localStorage
      const testKey = '__checkstbot_test__';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return true;
    } catch (error) {
      console.warn('localStorage not available:', error);
      return false;
    }
  }

  /**
   * Load all conversations from localStorage
   */
  private loadConversations(): ConversationData {
    if (!this.isStorageAvailable) {
      return {};
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        return {};
      }

      const parsed = JSON.parse(stored);
      // Validate that we have a proper object
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return parsed;
      }

      return {};
    } catch (error) {
      console.warn('Failed to load conversations from localStorage:', error);
      return {};
    }
  }

  /**
   * Save all conversations to localStorage
   */
  private saveConversations(conversations: ConversationData): void {
    if (!this.isStorageAvailable) {
      return;
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    } catch (error) {
      console.warn('Failed to save conversations to localStorage:', error);
    }
  }

  /**
   * Save messages for a specific document
   */
  public saveMessages(documentId: string, messages: Message[]): void {
    const conversations = this.loadConversations();
    conversations[documentId] = [...messages]; // Create a copy to avoid mutations
    this.saveConversations(conversations);
  }

  /**
   * Get messages for a specific document
   */
  public getMessages(documentId: string): Message[] {
    const conversations = this.loadConversations();
    return conversations[documentId] ? [...conversations[documentId]] : [];
  }

  /**
   * Add a single message to a document's conversation
   */
  public addMessage(documentId: string, message: Message): void {
    const conversations = this.loadConversations();
    if (!conversations[documentId]) {
      conversations[documentId] = [];
    }
    conversations[documentId].push({ ...message }); // Create a copy to avoid mutations
    this.saveConversations(conversations);
  }

  /**
   * Clear all messages for a document
   */
  public clearMessages(documentId: string): void {
    const conversations = this.loadConversations();
    conversations[documentId] = [];
    this.saveConversations(conversations);
  }

  /**
   * Get all document IDs that have conversations
   */
  public getAllConversations(): string[] {
    const conversations = this.loadConversations();
    return Object.keys(conversations);
  }
}