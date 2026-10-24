import { Link } from 'react-router-dom';
import { ArrowLeft, CircleDollarSign } from 'lucide-react';

export function BillingCancelPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0a0f1e] px-4">
      <section className="w-full max-w-md rounded-2xl border border-gray-800 bg-[#111827] p-8 text-center shadow-2xl">
        <CircleDollarSign className="mx-auto size-12 text-gray-500" />
        <h1 className="mt-5 text-2xl font-semibold text-white">Checkout cancelled</h1>
        <p className="mt-2 text-sm text-gray-400">
          Changed your mind? No worries. Your free plan is still active.
        </p>
        <Link
          to="/usage"
          className="mt-6 inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white shadow-sm shadow-blue-950/40 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          <ArrowLeft className="size-4" /> Back to usage
        </Link>
      </section>
    </main>
  );
}
