import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  Activity,
  KeyRound,
  LogOut,
  Menu,
  Settings,
  X,
  Zap,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '../../contexts/AuthContext.js';
import { Button } from '../ui/Button.js';
import { Logo } from '../ui/Logo.js';

const navigation = [
  { label: 'Events', to: '/events', icon: Activity },
  { label: 'API Keys', to: '/api-keys', icon: KeyRound },
  { label: 'Usage', to: '/usage', icon: Zap },
  { label: 'Settings', to: '/settings', icon: Settings },
];

export function DashboardLayout() {
  const { developer, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between border-b border-gray-800 px-5">
        <Logo onClick={() => setIsOpen(false)} />
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setIsOpen(false)}
          className="rounded-md p-1 text-gray-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 lg:hidden"
        >
          <X className="size-5" />
        </button>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-5">
        <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-600">
          Workspace
        </p>
        {navigation.map(({ label, to, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => setIsOpen(false)}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 rounded-r-lg border-l-2 px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
                isActive
                  ? 'border-blue-400 bg-blue-500/10 text-blue-200'
                  : 'border-transparent text-gray-400 hover:bg-gray-800/70 hover:text-gray-100',
              )
            }
          >
            <Icon className="size-4" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-gray-800 p-4">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gray-700 text-xs font-semibold text-gray-200">
            {developer?.email.slice(0, 1).toUpperCase() ?? 'D'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-gray-200">{developer?.email}</p>
            <p className="mt-0.5 text-[11px] capitalize text-gray-500">
              {developer?.plan ?? 'developer'} plan
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-gray-100">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-gray-800 bg-[#0d1423] lg:block">
        {sidebar}
      </aside>
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation overlay"
            className="absolute inset-0 bg-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            onClick={() => setIsOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-72 border-r border-gray-800 bg-[#0d1423] shadow-2xl">
            {sidebar}
          </aside>
        </div>
      )}
      <div className="min-h-screen lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-800 bg-[#0a0f1e]/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Open navigation"
              onClick={() => setIsOpen(true)}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 lg:hidden"
            >
              <Menu className="size-5" />
            </button>
            <div className="lg:hidden">
              <Logo compact />
            </div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden max-w-56 truncate text-sm text-gray-400 sm:block">
              {developer?.email}
            </span>
            <Button variant="ghost" size="sm" onClick={logout} className="gap-2">
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Log out</span>
            </Button>
          </div>
        </header>
        <main className="min-h-[calc(100vh-4rem)] overflow-x-hidden px-4 py-7 sm:px-6 sm:py-8 lg:px-8">
          <div key={window.location.pathname} className="mx-auto w-full max-w-7xl animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
