import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: "40px",
            maxWidth: "800px",
            margin: "40px auto",
            backgroundColor: "rgba(17, 24, 39, 0.9)",
            border: "1px solid rgba(239, 68, 68, 0.5)",
            borderRadius: "8px",
            color: "#f8fafc",
          }}
        >
          <h1 style={{ color: "#ef4444", marginBottom: "16px" }}>⚠️ Application Error</h1>
          <p style={{ marginBottom: "24px" }}>Something went wrong. Please refresh the page.</p>
          {this.state.error && (
            <details style={{ marginBottom: "16px" }}>
              <summary style={{ cursor: "pointer", marginBottom: "8px" }}>Error Details</summary>
              <pre
                style={{
                  padding: "12px",
                  backgroundColor: "rgba(0, 0, 0, 0.3)",
                  borderRadius: "4px",
                  overflow: "auto",
                  fontSize: "12px",
                }}
              >
                {this.state.error.toString()}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          )}
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "8px 16px",
              backgroundColor: "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
