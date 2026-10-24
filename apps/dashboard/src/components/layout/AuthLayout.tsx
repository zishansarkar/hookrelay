import { Outlet } from 'react-router-dom';
import { Logo } from '../ui/Logo.js';

export function AuthLayout() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,_rgba(37,99,235,0.14),_transparent_45%)] px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-7 flex justify-center">
          <Logo />
        </div>
        <section className="rounded-2xl border border-gray-800 bg-[#111827]/95 p-6 shadow-2xl shadow-black/20 sm:p-8">
          <Outlet />
        </section>
        <p className="mt-6 text-center text-xs text-gray-600">
          Reliable webhook delivery, built for developers.
        </p>
      </div>
    </main>
  );
}
