import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import App from './App.js';
import { AuthProvider } from './contexts/AuthContext.js';
import { ToastProvider } from './contexts/ToastContext.js';
import { RouteErrorBoundary } from './components/ui/RouteErrorBoundary.js';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (failureCount >= 2) return false;
        return !('response' in error) || Boolean(error.response === undefined);
      },
      retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 5_000),
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <RouteErrorBoundary>
              <App />
            </RouteErrorBoundary>
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
