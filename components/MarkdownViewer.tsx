import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism';

interface MarkdownViewerProps {
  file?: File;
  content?: string;
}

const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ file, content }) => {
  const [markdownContent, setMarkdownContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(!!file);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setMarkdownContent(text);
        setIsLoading(false);
      };
      reader.onerror = () => {
        setError('Fehler beim Lesen der Datei');
        setIsLoading(false);
      };
      reader.readAsText(file);
    } else if (content) {
      setMarkdownContent(content);
      setIsLoading(false);
    }
  }, [file, content]);

  if (isLoading) {
    return (
      <div className="markdown-loading">
        <div className="spinner"></div>
        <p>Dokument wird geladen...</p>
        <style jsx>{`
          .markdown-loading {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            padding: 2rem;
          }

          .spinner {
            width: 40px;
            height: 40px;
            border: 4px solid #e5e7eb;
            border-top-color: #0066CC;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-bottom: 1rem;
          }

          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }

          .markdown-loading p {
            color: #6b7280;
            font-size: 0.875rem;
          }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div className="markdown-error">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <h3>Fehler beim Laden</h3>
        <p>{error}</p>
        <style jsx>{`
          .markdown-error {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: #ef4444;
            text-align: center;
            padding: 2rem;
          }

          .markdown-error svg {
            margin-bottom: 1rem;
          }

          .markdown-error h3 {
            font-size: 1.25rem;
            margin-bottom: 0.5rem;
          }

          .markdown-error p {
            color: #6b7280;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="markdown-viewer">
      <div className="markdown-content">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            // Custom code block renderer with syntax highlighting
            code({ className, children, ...props }: any) {
              const match = /language-(\w+)/.exec(className || '');
              const isInline = !match;
              return !isInline && match ? (
                <SyntaxHighlighter
                  style={vscDarkPlus as any}
                  language={match[1]}
                  PreTag="div"
                  showLineNumbers
                >
                  {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
              ) : (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            },
            // Custom table renderer for better styling
            table({ children }) {
              return (
                <div className="table-wrapper">
                  <table>{children}</table>
                </div>
              );
            },
            // Custom link renderer to open in new tab
            a({ href, children }) {
              return (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="markdown-link"
                >
                  {children}
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    style={{ marginLeft: '4px', display: 'inline-block' }}
                  >
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                    <polyline points="15 3 21 3 21 9"></polyline>
                    <line x1="10" y1="14" x2="21" y2="3"></line>
                  </svg>
                </a>
              );
            },
            // Custom blockquote renderer
            blockquote({ children }) {
              return <blockquote className="markdown-blockquote">{children}</blockquote>;
            },
          }}
        >
          {markdownContent}
        </ReactMarkdown>
      </div>

      <style jsx global>{`
        .markdown-viewer {
          height: 100%;
          overflow-y: auto;
          background: white;
          padding: 2rem;
        }

        .markdown-content {
          max-width: 900px;
          margin: 0 auto;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          color: #1f2937;
          line-height: 1.7;
        }

        /* Headings */
        .markdown-content h1 {
          font-size: 2.25rem;
          font-weight: 700;
          margin-top: 2rem;
          margin-bottom: 1rem;
          color: #111827;
          border-bottom: 2px solid #e5e7eb;
          padding-bottom: 0.5rem;
        }

        .markdown-content h2 {
          font-size: 1.875rem;
          font-weight: 600;
          margin-top: 1.75rem;
          margin-bottom: 0.75rem;
          color: #111827;
          border-bottom: 1px solid #e5e7eb;
          padding-bottom: 0.25rem;
        }

        .markdown-content h3 {
          font-size: 1.5rem;
          font-weight: 600;
          margin-top: 1.5rem;
          margin-bottom: 0.5rem;
          color: #111827;
        }

        .markdown-content h4 {
          font-size: 1.25rem;
          font-weight: 600;
          margin-top: 1.25rem;
          margin-bottom: 0.5rem;
          color: #374151;
        }

        .markdown-content h5 {
          font-size: 1.125rem;
          font-weight: 600;
          margin-top: 1rem;
          margin-bottom: 0.5rem;
          color: #374151;
        }

        .markdown-content h6 {
          font-size: 1rem;
          font-weight: 600;
          margin-top: 1rem;
          margin-bottom: 0.5rem;
          color: #4b5563;
        }

        /* Paragraphs */
        .markdown-content p {
          margin-bottom: 1rem;
          color: #374151;
        }

        /* Links */
        .markdown-link {
          color: #0066CC;
          text-decoration: none;
          border-bottom: 1px solid transparent;
          transition: all 0.2s;
        }

        .markdown-link:hover {
          border-bottom-color: #0066CC;
        }

        /* Lists */
        .markdown-content ul,
        .markdown-content ol {
          margin-bottom: 1rem;
          padding-left: 2rem;
          color: #374151;
        }

        .markdown-content li {
          margin-bottom: 0.25rem;
        }

        .markdown-content ul ul,
        .markdown-content ol ol,
        .markdown-content ul ol,
        .markdown-content ol ul {
          margin-top: 0.25rem;
          margin-bottom: 0.25rem;
        }

        /* Blockquotes */
        .markdown-blockquote {
          border-left: 4px solid #0066CC;
          padding-left: 1rem;
          margin: 1.5rem 0;
          color: #4b5563;
          font-style: italic;
          background: #f9fafb;
          padding: 1rem;
          border-radius: 0 4px 4px 0;
        }

        /* Code */
        .markdown-content code {
          background: #f3f4f6;
          color: #ef4444;
          padding: 0.125rem 0.25rem;
          border-radius: 4px;
          font-size: 0.875rem;
          font-family: 'SF Mono', Monaco, 'Courier New', monospace;
        }

        .markdown-content pre {
          margin: 1.5rem 0;
          border-radius: 8px;
          overflow: hidden;
        }

        .markdown-content pre code {
          background: transparent;
          color: inherit;
          padding: 0;
          font-size: 0.875rem;
        }

        /* Tables */
        .table-wrapper {
          overflow-x: auto;
          margin: 1.5rem 0;
        }

        .markdown-content table {
          width: 100%;
          border-collapse: collapse;
          border: 1px solid #e5e7eb;
          background: white;
        }

        .markdown-content th {
          background: #f9fafb;
          padding: 0.75rem 1rem;
          text-align: left;
          font-weight: 600;
          color: #111827;
          border: 1px solid #e5e7eb;
        }

        .markdown-content td {
          padding: 0.75rem 1rem;
          border: 1px solid #e5e7eb;
          color: #374151;
        }

        .markdown-content tr:hover {
          background: #f9fafb;
        }

        /* Horizontal Rules */
        .markdown-content hr {
          border: none;
          border-top: 2px solid #e5e7eb;
          margin: 2rem 0;
        }

        /* Images */
        .markdown-content img {
          max-width: 100%;
          height: auto;
          border-radius: 8px;
          margin: 1.5rem 0;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        /* Checkboxes */
        .markdown-content input[type="checkbox"] {
          margin-right: 0.5rem;
        }

        /* Scrollbar */
        .markdown-viewer::-webkit-scrollbar {
          width: 8px;
        }

        .markdown-viewer::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 4px;
        }

        .markdown-viewer::-webkit-scrollbar-thumb {
          background: #c3c3c3;
          border-radius: 4px;
        }

        .markdown-viewer::-webkit-scrollbar-thumb:hover {
          background: #999;
        }

        @media (max-width: 768px) {
          .markdown-viewer {
            padding: 1rem;
          }

          .markdown-content h1 {
            font-size: 1.875rem;
          }

          .markdown-content h2 {
            font-size: 1.5rem;
          }

          .markdown-content h3 {
            font-size: 1.25rem;
          }
        }
      `}</style>
    </div>
  );
};

export default MarkdownViewer;