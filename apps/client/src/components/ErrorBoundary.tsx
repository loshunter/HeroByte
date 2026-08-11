import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  /**
   * What to show INSTEAD of the full-page error, for a boundary that guards
   * one panel rather than the app. Without this every boundary is a total
   * loss: a lazy chunk that 404s — the realistic case is a deploy invalidating
   * hashed chunk names mid-session — takes the whole table down with it, and
   * a table is a live shared thing you cannot just reload out from under.
   *
   * A plain node, NOT a render prop taking a retry. This boundary shipped with
   * one and it was a lie for its only caller: React caches a lazy payload's
   * REJECTION permanently (react 18.3.1, lazyInitializer re-runs the ctor only
   * while `_status === Uninitialized`, and a rejected payload re-throws
   * `_result` on every subsequent render). Clearing the boundary just renders
   * the same rejected lazy and throws again. A fallback that cannot recover
   * should not offer to.
   */
  fallback?: ReactNode;
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
      if (this.props.fallback) return this.props.fallback;
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
