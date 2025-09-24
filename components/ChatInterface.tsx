import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import MessageBubble from './MessageBubble';
import { fetchCSRFToken, getCSRFTokenFromCookie } from '../lib/csrf-client';

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
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome-message',
      role: 'assistant',
      content: '👋 Hallo! Ich bin Ihr intelligenter Lernassistent. Stellen Sie mir gerne Fragen zu Ihrem Dokument!',
      timestamp: new Date().toISOString(),
      model: CHAT_MODEL
    }
  ]);
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

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Server error: ${res.status}`);
      }

      const aiMessage: Message = {
        id: generateUniqueId(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date().toISOString(),
        model: CHAT_MODEL
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      let errorContent = 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.';

      if (error instanceof Error) {
        if (error.message.includes('429')) {
          errorContent = 'Zu viele Anfragen. Bitte warten Sie einen Moment.';
        } else if (error.message.includes('context')) {
          errorContent = 'Bitte laden Sie zuerst ein Dokument hoch.';
        }
      }

      const errorMessage: Message = {
        id: generateUniqueId(),
        role: 'assistant',
        content: errorContent,
        timestamp: new Date().toISOString(),
        model: CHAT_MODEL
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, csrfToken, documentId]); // Removed 'messages' from dependencies

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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

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
          background: #ffffff;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }

        .chat-messages-container {
          flex: 1;
          overflow-y: auto;
          padding: 1.5rem;
          background: linear-gradient(to bottom, #f9fafb, #ffffff);
        }

        .chat-messages-container::-webkit-scrollbar {
          width: 8px;
        }

        .chat-messages-container::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 4px;
        }

        .chat-messages-container::-webkit-scrollbar-thumb {
          background: #c3c3c3;
          border-radius: 4px;
        }

        .chat-messages-container::-webkit-scrollbar-thumb:hover {
          background: #999;
        }

        .chat-input-modern {
          padding: 1rem 1.5rem;
          background: #ffffff;
          border-top: 1px solid #e5e7eb;
        }

        .input-wrapper {
          display: flex;
          align-items: flex-end;
          gap: 0.75rem;
          position: relative;
        }

        .message-textarea {
          flex: 1;
          padding: 0.75rem 1rem;
          border: 2px solid #e5e7eb;
          border-radius: 10px;
          font-size: 0.95rem;
          font-family: inherit;
          resize: none;
          outline: none;
          transition: all 0.2s;
          max-height: 200px;
          line-height: 1.5;
        }

        .message-textarea:focus {
          border-color: #0066CC;
          box-shadow: 0 0 0 3px rgba(0, 102, 204, 0.1);
        }

        .message-textarea:disabled {
          background: #f9fafb;
          color: #9ca3af;
          cursor: not-allowed;
        }

        .send-button {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          background: #0066CC;
          color: white;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
          flex-shrink: 0;
        }

        .send-button:hover:not(:disabled) {
          background: #0052a3;
          transform: scale(1.05);
        }

        .send-button:disabled {
          background: #e5e7eb;
          color: #9ca3af;
          cursor: not-allowed;
        }

        .loading-spinner {
          width: 20px;
          height: 20px;
          border: 2px solid #ffffff;
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .input-helper {
          margin-top: 0.5rem;
          padding: 0 0.5rem;
        }

        .helper-text {
          font-size: 0.75rem;
          color: #6b7280;
        }

        @media (max-width: 768px) {
          .chat-messages-container {
            padding: 1rem;
          }

          .chat-input-modern {
            padding: 0.75rem 1rem;
          }
        }
      `}</style>
    </div>
  );
});

ChatInterface.displayName = 'ChatInterface';

export default ChatInterface;