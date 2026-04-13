import { Component, type ReactNode, type ErrorInfo } from "react";

interface ErrorBoundaryProps {
  readonly children: ReactNode;
  readonly fallback?: ReactNode;
  readonly name?: string;
}

interface ErrorBoundaryState {
  readonly hasError: boolean;
  readonly error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[ErrorBoundary${this.props.name ? `:${this.props.name}` : ""}]`, error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center gap-2 p-6 text-center">
          <span className="text-[1.2rem]" style={{ color: "var(--color-pn-error)" }}>
            &#x26A0;
          </span>
          <p className="text-[0.75rem]" style={{ color: "var(--pn-text-secondary)" }}>
            {this.props.name ? `${this.props.name} failed to render` : "Something went wrong"}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-1 px-3 py-1 text-[0.7rem] rounded-md glass-surface transition-colors hover:bg-white/10"
            style={{ color: "var(--pn-text-secondary)" }}
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
