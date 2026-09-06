import { Component, ErrorInfo, ReactNode } from 'react';

export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  public state = { hasError: false };

  public static getDerivedStateFromError(_: Error) {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-parchment p-6 w-full">
          <div className="text-center p-12 bg-white rounded-2xl shadow-panel max-w-lg w-full border border-neutral-100">
            <div className="mb-6 mx-auto w-24 h-24 bg-red-50 rounded-full flex items-center justify-center shadow-inner">
              <svg className="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
              </svg>
            </div>
            <h2 className="display-font text-3xl font-bold mb-4 text-primary-900">System Interruption</h2>
            <p className="text-neutral-500 mb-8 leading-relaxed">
              We encountered an unexpected error on this judging terminal. Your previously submitted scores are securely saved in the main tabulator.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-8 py-3.5 bg-primary-800 hover:bg-primary-900 text-white font-semibold rounded-lg shadow-sm hover:shadow-md transition-all duration-200 w-full tracking-wide uppercase text-sm border-b-2 border-primary-950"
            >
              Restart Terminal
            </button>
            <p className="text-xs text-neutral-400 mt-6">
              If this issue persists, please notify the Tabulation Admin immediately.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
