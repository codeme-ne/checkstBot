import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { showToast } from './Toast';

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
  isStreaming?: boolean;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ role, content, timestamp, isStreaming }) => {
  const isUser = role === 'user';

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('Code in die Zwischenablage kopiert!', 'success');
  };

  return (
    <div className={`message-bubble ${isUser ? 'user-message' : 'assistant-message'}`}>
      <div className="message-header">
        <span className="message-role">
          {isUser ? '👤 You' : '🤖 Assistant'}
        </span>
        {timestamp && (
          <span className="message-time">
            {new Date(timestamp).toLocaleTimeString('de-DE', {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </span>
        )}
      </div>

      <div className="message-content">
        {isUser ? (
          <p>{content}</p>
        ) : (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ node, inline, className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '');
                const codeContent = String(children).replace(/\n$/, '');

                return !inline && match ? (
                  <div className="code-block-wrapper">
                    <div className="code-block-header">
                      <span className="code-language">{match[1]}</span>
                      <button
                        onClick={() => copyToClipboard(codeContent)}
                        className="copy-button"
                        title="Copy code"
                      >
                        📋 Copy
                      </button>
                    </div>
                    <SyntaxHighlighter
                      style={vscDarkPlus}
                      language={match[1]}
                      PreTag="div"
                      {...props}
                    >
                      {codeContent}
                    </SyntaxHighlighter>
                  </div>
                ) : (
                  <code className={`inline-code ${className || ''}`} {...props}>
                    {children}
                  </code>
                );
              },
              // Style tables
              table({ children }) {
                return (
                  <div className="table-wrapper">
                    <table className="markdown-table">{children}</table>
                  </div>
                );
              },
              // Style links
              a({ href, children }) {
                return (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="markdown-link">
                    {children}
                  </a>
                );
              },
              // Style lists
              ul({ children }) {
                return <ul className="markdown-list">{children}</ul>;
              },
              ol({ children }) {
                return <ol className="markdown-list ordered">{children}</ol>;
              },
              // Style blockquotes
              blockquote({ children }) {
                return <blockquote className="markdown-blockquote">{children}</blockquote>;
              }
            }}
          >
            {content}
          </ReactMarkdown>
        )}

        {isStreaming && (
          <span className="streaming-indicator">
            <span className="dot"></span>
            <span className="dot"></span>
            <span className="dot"></span>
          </span>
        )}
      </div>

      <style jsx>{`
        .message-bubble {
          margin: 1rem 0;
          padding: 0;
          animation: slideIn 0.3s ease;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .user-message {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
        }

        .assistant-message {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        }

        .message-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
          font-size: 0.875rem;
          color: #666;
        }

        .message-role {
          font-weight: 500;
        }

        .message-time {
          color: #999;
          font-size: 0.75rem;
        }

        .message-content {
          max-width: 70%;
          padding: 0.75rem 1rem;
          border-radius: 0.75rem;
          position: relative;
        }

        .user-message .message-content {
          background: #0066CC;
          color: white;
          border-bottom-right-radius: 0.25rem;
        }

        .assistant-message .message-content {
          background: #F7F7F8;
          color: #1a1a1a;
          border: 1px solid #E5E5E7;
          border-bottom-left-radius: 0.25rem;
        }

        .message-content p {
          margin: 0 0 0.5rem 0;
        }

        .message-content p:last-child {
          margin-bottom: 0;
        }

        /* Code blocks */
        .code-block-wrapper {
          margin: 0.5rem 0;
          border-radius: 0.5rem;
          overflow: hidden;
          background: #1e1e1e;
        }

        .code-block-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.5rem 1rem;
          background: #2d2d30;
          border-bottom: 1px solid #3e3e42;
        }

        .code-language {
          color: #cccccc;
          font-size: 0.875rem;
          font-family: 'SF Mono', Monaco, monospace;
        }

        .copy-button {
          background: transparent;
          border: 1px solid #3e3e42;
          color: #cccccc;
          padding: 0.25rem 0.5rem;
          border-radius: 0.25rem;
          font-size: 0.75rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .copy-button:hover {
          background: #3e3e42;
          border-color: #007ACC;
        }

        .inline-code {
          background: rgba(0, 102, 204, 0.1);
          color: #0066CC;
          padding: 0.125rem 0.25rem;
          border-radius: 0.25rem;
          font-family: 'SF Mono', Monaco, monospace;
          font-size: 0.875em;
        }

        .user-message .inline-code {
          background: rgba(255, 255, 255, 0.2);
          color: white;
        }

        /* Tables */
        .table-wrapper {
          overflow-x: auto;
          margin: 0.5rem 0;
        }

        .markdown-table {
          border-collapse: collapse;
          width: 100%;
        }

        .markdown-table th,
        .markdown-table td {
          border: 1px solid #E5E5E7;
          padding: 0.5rem;
          text-align: left;
        }

        .markdown-table th {
          background: #F7F7F8;
          font-weight: 600;
        }

        /* Links */
        .markdown-link {
          color: #0066CC;
          text-decoration: none;
          border-bottom: 1px solid transparent;
          transition: border-color 0.2s;
        }

        .markdown-link:hover {
          border-bottom-color: #0066CC;
        }

        /* Lists */
        .markdown-list {
          margin: 0.5rem 0;
          padding-left: 1.5rem;
        }

        .markdown-list li {
          margin: 0.25rem 0;
        }

        /* Blockquotes */
        .markdown-blockquote {
          border-left: 4px solid #0066CC;
          padding-left: 1rem;
          margin: 0.5rem 0;
          color: #666;
          font-style: italic;
        }

        /* Streaming indicator */
        .streaming-indicator {
          display: inline-flex;
          gap: 0.25rem;
          margin-left: 0.5rem;
        }

        .streaming-indicator .dot {
          width: 8px;
          height: 8px;
          background: #0066CC;
          border-radius: 50%;
          animation: pulse 1.4s infinite;
        }

        .streaming-indicator .dot:nth-child(2) {
          animation-delay: 0.2s;
        }

        .streaming-indicator .dot:nth-child(3) {
          animation-delay: 0.4s;
        }

        @keyframes pulse {
          0%, 60%, 100% {
            opacity: 0.3;
            transform: scale(0.8);
          }
          30% {
            opacity: 1;
            transform: scale(1);
          }
        }

        /* Responsive */
        @media (max-width: 768px) {
          .message-content {
            max-width: 85%;
          }
        }
      `}</style>
    </div>
  );
};

export default MessageBubble;