import { Component, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0a0f1e] px-4">
        <section role="alert" className="max-w-md text-center">
          <AlertTriangle className="mx-auto size-9 text-amber-400" />
          <h1 className="mt-4 text-xl font-semibold text-white">This page hit an unexpected error</h1>
          <p className="mt-2 text-sm text-gray-300">Refresh the page or return to your dashboard.</p>
          <div className="mt-5 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-200 hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              Try again
            </button>
            <Link
              to="/events"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              Dashboard
            </Link>
          </div>
        </section>
      </main>
    );
  }
}
