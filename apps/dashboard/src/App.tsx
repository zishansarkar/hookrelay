import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext.js';
import { AuthLayout } from './components/layout/AuthLayout.js';
import { DashboardLayout } from './components/layout/DashboardLayout.js';
import { Spinner } from './components/ui/Spinner.js';
import { ApiKeysPage } from './pages/ApiKeysPage.js';
import { EventDetailPage } from './pages/EventDetailPage.js';
import { EventsPage } from './pages/EventsPage.js';
import { LoginPage } from './pages/LoginPage.js';
import { RegisterPage } from './pages/RegisterPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { UsagePage } from './pages/UsagePage.js';

function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0f1e]">
        <Spinner className="size-6 text-blue-400" />
      </div>
    );
  }
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}

function GuestRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0f1e]">
        <Spinner className="size-6 text-blue-400" />
      </div>
    );
  }
  return isAuthenticated ? <Navigate to="/events" replace /> : <Outlet />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/events" replace />} />
      <Route element={<GuestRoute />}>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/events" element={<EventsPage />} />
          <Route path="/events/:id" element={<EventDetailPage />} />
          <Route path="/api-keys" element={<ApiKeysPage />} />
          <Route path="/usage" element={<UsagePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/events" replace />} />
    </Routes>
  );
}
