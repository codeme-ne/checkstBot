import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import MessageBubble from './MessageBubble';
import { fetchCSRFToken, getCSRFTokenFromCookie } from '../lib/csrf-client';
import { ChatStorageService } from '../lib/chat-storage';

// Generate unique IDs to prevent collision risk
const generateUniqueId = () => `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

// Centralized model configuration
const CHAT_MODEL = 'gpt-4';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  model?: string;
  isStreaming?: boolean;
  sources?: string[];
}

export interface ChatInterfaceHandle {
  sendMessage: (message: string) => void;
}

interface ChatInterfaceProps {
  documentId: string;
  queuedUserMessage?: string;
  onQueueConsumed?: () => void;
}

const ChatInterface = forwardRef<ChatInterfaceHandle, ChatInterfaceProps>(({
  documentId,
  queuedUserMessage,
  onQueueConsumed
}, ref) => {
  // Initialize storage service
  const [chatStorage] = useState(() => new ChatStorageService());

  // Create welcome message
  const createWelcomeMessage = useCallback((): Message => ({
    id: 'welcome-message',
    role: 'assistant',
    content: '👋 Hallo! Ich bin Ihr intelligenter Lernassistent. Stellen Sie mir gerne Fragen zu Ihrem Dokument!',
    timestamp: new Date().toISOString(),
    model: CHAT_MODEL
  }), []);

  const [messages, setMessages] = useState<Message[]>(() => {
    // Load messages from storage for this document
    const storedMessages = chatStorage.getMessages(documentId);

    // If no stored messages, start with welcome message
    if (storedMessages.length === 0) {
      const welcomeMessage = createWelcomeMessage();
      chatStorage.saveMessages(documentId, [welcomeMessage]);
      return [welcomeMessage];
    }

    return storedMessages;
  });
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [csrfToken, setCsrfToken] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Fetch CSRF token on component mount
    fetchCSRFToken().then(token => {
      setCsrfToken(token);
    });
  }, []);

  // Load messages when documentId changes
  useEffect(() => {
    const storedMessages = chatStorage.getMessages(documentId);

    if (storedMessages.length === 0) {
      // New document - create welcome message
      const welcomeMessage = createWelcomeMessage();
      chatStorage.saveMessages(documentId, [welcomeMessage]);
      setMessages([welcomeMessage]);
    } else {
      // Load existing conversation
      setMessages(storedMessages);
    }
  }, [documentId, chatStorage, createWelcomeMessage]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [inputMessage]);

  // Extract core message sending logic for reuse
  const sendMessageInternal = useCallback(async (messageContent: string) => {
    if (!messageContent.trim() || isLoading) return;

    const userMessage: Message = {
      id: generateUniqueId(),
      role: 'user',
      content: messageContent,
      timestamp: new Date().toISOString()
    };

    // Use functional update and capture updated messages for API call
    let updatedMessages: Message[];
    setMessages(prevMessages => {
      updatedMessages = [...prevMessages, userMessage];
      // Save user message to storage immediately
      chatStorage.saveMessages(documentId, updatedMessages);
      return updatedMessages;
    });
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({
          message: messageContent,
          chatHistory: updatedMessages!,
          documentId: documentId
        }),
      });

      const responseText = await res.text();
      let data: { response?: string; error?: string; message?: string; sources?: string[] } = {};
      if (responseText) {
        try {
          data = JSON.parse(responseText);
        } catch {
          data = {};
        }
      }

      if (!res.ok) {
        throw new Error(data.error || data.message || `Server error: ${res.status}`);
      }

      if (!data.response) {
        throw new Error('Ungültige Serverantwort vom Chat-Service');
      }

      const aiMessage: Message = {
        id: generateUniqueId(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date().toISOString(),
        model: CHAT_MODEL,
        sources: Array.isArray(data.sources) ? data.sources : undefined
      };

      setMessages(prev => {
        const newMessages = [...prev, aiMessage];
        // Save AI response to storage
        chatStorage.saveMessages(documentId, newMessages);
        return newMessages;
      });
    } catch (error) {
      // Use actual API error message if available, otherwise fallback
      let errorContent = 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.';

      if (error instanceof Error) {
        // Check for specific known errors, then use the actual message
        if (error.message.includes('429')) {
          errorContent = 'Zu viele Anfragen. Bitte warten Sie einen Moment.';
        } else if (error.message.includes('CSRF')) {
          errorContent = 'Sitzung abgelaufen. Bitte laden Sie die Seite neu.';
        } else if (error.message && !error.message.includes('Server error')) {
          // Use the actual API error message (German messages from backend)
          errorContent = error.message;
        }
      }

      const errorMessage: Message = {
        id: generateUniqueId(),
        role: 'assistant',
        content: errorContent,
        timestamp: new Date().toISOString(),
        model: CHAT_MODEL
      };
      setMessages(prev => {
        const newMessages = [...prev, errorMessage];
        // Save error message to storage
        chatStorage.saveMessages(documentId, newMessages);
        return newMessages;
      });
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, csrfToken, documentId, chatStorage]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;
    const messageToSend = inputMessage;
    setInputMessage('');
    await sendMessageInternal(messageToSend);
  };

  // Expose programmatic message sending via ref
  useImperativeHandle(ref, () => ({
    sendMessage: (message: string) => {
      sendMessageInternal(message);
    }
  }), [sendMessageInternal]);

  // Handle queued messages
  useEffect(() => {
    if (queuedUserMessage && !isLoading) {
      sendMessageInternal(queuedUserMessage);
      onQueueConsumed?.();
    }
  }, [queuedUserMessage, isLoading, sendMessageInternal, onQueueConsumed]);

  return (
    <div className="chat-interface-modern">
      <div className="chat-messages-container">
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            role={msg.role}
            content={msg.content}
            timestamp={msg.timestamp}
            isStreaming={msg.isStreaming}
            sources={msg.sources}
          />
        ))}
        {isLoading && (
          <MessageBubble
            role="assistant"
            content=""
            isStreaming={true}
          />
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-modern">
        <div className="input-wrapper">
          <textarea
            ref={textareaRef}
            className="message-textarea"
            placeholder={documentId ? "Stellen Sie eine Frage zu Ihrem Dokument..." : "Bitte laden Sie zuerst ein Dokument hoch..."}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            disabled={isLoading || !documentId}
            rows={1}
          />
          <button
            className="send-button"
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isLoading || !documentId}
            aria-label="Nachricht senden"
          >
            {isLoading ? (
              <div className="loading-spinner" />
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 2L11 13" />
                <path d="M22 2L15 22L11 13L2 9L22 2Z" />
              </svg>
            )}
          </button>
        </div>
        <div className="input-helper">
          <span className="helper-text">
            {documentId ? 'Enter zum Senden • Shift+Enter für neue Zeile' : 'Dokument erforderlich'}
          </span>
        </div>
      </div>

      <style jsx>{`
        .chat-interface-modern {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: transparent;
          overflow: hidden;
        }

        .chat-messages-container {
          flex: 1;
          overflow-y: auto;
          padding: 1.25rem;
          background: transparent;
        }

        .chat-messages-container::-webkit-scrollbar {
          width: 6px;
        }

        .chat-messages-container::-webkit-scrollbar-track {
          background: transparent;
        }

        .chat-messages-container::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 3px;
        }

        .chat-messages-container::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        .chat-input-modern {
          padding: 0.875rem 1.25rem;
          background: #141416;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }

        .input-wrapper {
          display: flex;
          align-items: flex-end;
          gap: 0.625rem;
          position: relative;
        }

        .message-textarea {
          flex: 1;
          padding: 0.625rem 0.875rem;
          background: #1a1a1c;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          font-size: 0.875rem;
          font-family: inherit;
          color: #f5f5f5;
          resize: none;
          outline: none;
          transition: all 0.2s;
          max-height: 160px;
          line-height: 1.5;
        }

        .message-textarea::placeholder {
          color: #71717a;
        }

        .message-textarea:focus {
          border-color: rgba(50, 184, 198, 0.5);
          box-shadow: 0 0 0 2px rgba(50, 184, 198, 0.1);
        }

        .message-textarea:disabled {
          background: #0d0d0f;
          color: #52525b;
          cursor: not-allowed;
        }

        .send-button {
          width: 38px;
          height: 38px;
          border-radius: 8px;
          background: #32B8C6;
          color: #0d0d0f;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
          flex-shrink: 0;
        }

        .send-button:hover:not(:disabled) {
          background: #3dd4e4;
          box-shadow: 0 0 12px rgba(50, 184, 198, 0.3);
        }

        .send-button:disabled {
          background: #252529;
          color: #52525b;
          cursor: not-allowed;
        }

        .loading-spinner {
          width: 18px;
          height: 18px;
          border: 2px solid rgba(13, 13, 15, 0.3);
          border-top-color: #0d0d0f;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .input-helper {
          margin-top: 0.375rem;
          padding: 0 0.25rem;
        }

        .helper-text {
          font-size: 0.6875rem;
          color: #52525b;
        }

        @media (max-width: 768px) {
          .chat-messages-container {
            padding: 0.875rem;
          }

          .chat-input-modern {
            padding: 0.625rem 0.875rem;
          }
        }
      `}</style>
    </div>
  );
});

ChatInterface.displayName = 'ChatInterface';

export default ChatInterface;
