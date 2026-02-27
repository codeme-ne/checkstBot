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
              code({ className, children, ...props }: any) {
                const match = /language-(\w+)/.exec(className || '');
                const codeContent = String(children).replace(/\n$/, '');
                const isInline = !match;

                return !isInline && match ? (
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
                      style={vscDarkPlus as any}
                      language={match[1]}
                      PreTag="div"
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
              li({ children }) {
                return <li className="markdown-list-item">{children}</li>;
              },
              h3({ children }) {
                return <h3 className="markdown-heading">{children}</h3>;
              },
              p({ children }) {
                return <p className="markdown-paragraph">{children}</p>;
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
          margin: 0.875rem 0;
          padding: 0;
          animation: slideIn 0.25s ease;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(6px);
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
          gap: 0.375rem;
          margin-bottom: 0.375rem;
          font-size: 0.75rem;
          color: #71717a;
        }

        .message-role {
          font-weight: 500;
        }

        .message-time {
          color: #52525b;
          font-size: 0.6875rem;
        }

        .message-content {
          max-width: 75%;
          padding: 0.625rem 0.875rem;
          border-radius: 10px;
          position: relative;
          font-size: 0.875rem;
          line-height: 1.55;
        }

        .user-message .message-content {
          background: #32B8C6;
          color: #0a0a0b;
          border-bottom-right-radius: 4px;
        }

        .assistant-message .message-content {
          background: #1e1e22;
          color: #e4e4e7;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-bottom-left-radius: 4px;
        }

        .message-content p {
          margin: 0 0 0.375rem 0;
        }

        .message-content p:last-child {
          margin-bottom: 0;
        }

        .markdown-heading {
          margin: 0.25rem 0 0.4rem;
          font-size: 0.76rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #67e8f9;
        }

        .markdown-paragraph {
          margin: 0 0 0.45rem 0;
        }

        /* Code blocks - Dark Theme */
        .code-block-wrapper {
          margin: 0.5rem 0;
          border-radius: 8px;
          overflow: hidden;
          background: #0d0d0f;
          border: 1px solid rgba(255, 255, 255, 0.06);
        }

        .code-block-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.375rem 0.75rem;
          background: #141416;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .code-language {
          color: #71717a;
          font-size: 0.6875rem;
          font-family: 'SF Mono', Monaco, monospace;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .copy-button {
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #a1a1aa;
          padding: 0.1875rem 0.5rem;
          border-radius: 4px;
          font-size: 0.6875rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .copy-button:hover {
          background: rgba(50, 184, 198, 0.1);
          border-color: rgba(50, 184, 198, 0.3);
          color: #32B8C6;
        }

        .inline-code {
          background: rgba(50, 184, 198, 0.15);
          color: #32B8C6;
          padding: 0.125rem 0.3rem;
          border-radius: 4px;
          font-family: 'SF Mono', Monaco, monospace;
          font-size: 0.8125em;
        }

        .user-message .inline-code {
          background: rgba(10, 10, 11, 0.3);
          color: #0a0a0b;
        }

        /* Tables - Dark Mode */
        .table-wrapper {
          overflow-x: auto;
          margin: 0.5rem 0;
        }

        .markdown-table {
          border-collapse: collapse;
          width: 100%;
          font-size: 0.8125rem;
        }

        .markdown-table th,
        .markdown-table td {
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 0.375rem 0.5rem;
          text-align: left;
        }

        .markdown-table th {
          background: #141416;
          font-weight: 500;
          color: #a1a1aa;
        }

        /* Links */
        .markdown-link {
          color: #32B8C6;
          text-decoration: none;
          border-bottom: 1px solid transparent;
          transition: all 0.2s;
        }

        .markdown-link:hover {
          border-bottom-color: #32B8C6;
        }

        /* Lists */
        .markdown-list {
          margin: 0.3rem 0 0.15rem;
          padding-left: 1.25rem;
        }

        .markdown-list-item {
          margin: 0.22rem 0;
        }

        .assistant-message .markdown-list-item {
          color: #d4d4d8;
        }

        /* Blockquotes */
        .markdown-blockquote {
          border-left: 3px solid #32B8C6;
          padding-left: 0.75rem;
          margin: 0.375rem 0;
          color: #a1a1aa;
          font-style: italic;
        }

        /* Streaming indicator */
        .streaming-indicator {
          display: inline-flex;
          gap: 0.1875rem;
          margin-left: 0.375rem;
        }

        .streaming-indicator .dot {
          width: 6px;
          height: 6px;
          background: #32B8C6;
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
            max-width: 88%;
          }
        }
      `}</style>
    </div>
  );
};

export default MessageBubble;
