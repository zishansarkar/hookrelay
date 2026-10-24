import { lazy, Suspense } from 'react';
import { Link, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext.js';
import { AuthLayout } from './components/layout/AuthLayout.js';
import { DashboardLayout } from './components/layout/DashboardLayout.js';
import { ApiKeysPage } from './pages/ApiKeysPage.js';
import { BillingCancelPage } from './pages/BillingCancelPage.js';
import { BillingSuccessPage } from './pages/BillingSuccessPage.js';
import { EventDetailPage } from './pages/EventDetailPage.js';
import { EventsPage } from './pages/EventsPage.js';
import { LoginPage } from './pages/LoginPage.js';
import { RegisterPage } from './pages/RegisterPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { PageSkeleton } from './components/ui/Skeleton.js';
import { LandingPage } from './pages/LandingPage.js';

function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0a0f1e] px-4">
      <div className="text-center">
        <p className="font-mono text-sm text-blue-300">404</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">This page doesn&apos;t exist</h1>
        <p className="mt-2 text-sm text-gray-400">
          The link may be broken or the page may have moved.
        </p>
        <Link
          to="/events"
          className="mt-5 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          Go to dashboard
        </Link>
      </div>
    </main>
  );
}

const UsagePage = lazy(() =>
  import('./pages/UsagePage.js').then((module) => ({ default: module.UsagePage })),
);

function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0f1e] p-6">
        <PageSkeleton />
      </div>
    );
  }
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}

function GuestRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0f1e] p-6">
        <PageSkeleton />
      </div>
    );
  }
  return isAuthenticated ? <Navigate to="/events" replace /> : <Outlet />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route element={<GuestRoute />}>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<Navigate to="/events" replace />} />
        <Route path="/billing/success" element={<BillingSuccessPage />} />
        <Route path="/billing/cancel" element={<BillingCancelPage />} />
        <Route element={<DashboardLayout />}>
          <Route path="/events" element={<EventsPage />} />
          <Route path="/events/:id" element={<EventDetailPage />} />
          <Route path="/api-keys" element={<ApiKeysPage />} />
          <Route
            path="/usage"
            element={
              <Suspense fallback={<PageSkeleton />}>
                <UsagePage />
              </Suspense>
            }
          />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
