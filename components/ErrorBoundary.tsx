import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Keep client-side logging browser-safe.
    console.error('React Error Boundary caught an error', {
      error: error.toString(),
      componentStack: errorInfo.componentStack,
      errorBoundary: 'main',
      timestamp: new Date().toISOString()
    });

    this.setState({
      error,
      errorInfo
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return <>{this.props.fallback}</>;
      }

      return (
        <div className="error-boundary-container">
          <div className="error-content">
            <h1>⚠️ Etwas ist schief gelaufen</h1>
            <p>Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es erneut.</p>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="error-details">
                <summary>Fehlerdetails (nur für Entwicklung)</summary>
                <pre>{this.state.error.toString()}</pre>
                {this.state.errorInfo && (
                  <pre>{this.state.errorInfo.componentStack}</pre>
                )}
              </details>
            )}

            <button onClick={this.handleReset} className="reset-button">
              Neu laden
            </button>
          </div>

          <style jsx>{`
            .error-boundary-container {
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              padding: 2rem;
            }

            .error-content {
              background: white;
              border-radius: 1rem;
              padding: 3rem;
              max-width: 600px;
              width: 100%;
              box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1),
                          0 10px 10px -5px rgba(0, 0, 0, 0.04);
              text-align: center;
            }

            h1 {
              color: #1a202c;
              font-size: 1.875rem;
              font-weight: 700;
              margin-bottom: 1rem;
            }

            p {
              color: #4a5568;
              font-size: 1.125rem;
              margin-bottom: 2rem;
            }

            .error-details {
              background: #f7fafc;
              border: 1px solid #e2e8f0;
              border-radius: 0.5rem;
              padding: 1rem;
              margin: 1.5rem 0;
              text-align: left;
            }

            .error-details summary {
              cursor: pointer;
              color: #4a5568;
              font-weight: 500;
              margin-bottom: 0.5rem;
            }

            .error-details pre {
              color: #e53e3e;
              font-family: 'Courier New', monospace;
              font-size: 0.875rem;
              white-space: pre-wrap;
              word-wrap: break-word;
              margin-top: 0.5rem;
            }

            .reset-button {
              background: #667eea;
              color: white;
              border: none;
              border-radius: 0.5rem;
              padding: 0.75rem 2rem;
              font-size: 1rem;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.2s;
            }

            .reset-button:hover {
              background: #5a67d8;
              transform: translateY(-1px);
              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1),
                          0 2px 4px -1px rgba(0, 0, 0, 0.06);
            }

            .reset-button:active {
              transform: translateY(0);
            }

            @media (max-width: 640px) {
              .error-content {
                padding: 2rem;
              }

              h1 {
                font-size: 1.5rem;
              }

              p {
                font-size: 1rem;
              }
            }
          `}</style>
        </div>
      );
    }

    return this.props.children;
  }
}
