import { Link } from 'react-router-dom';
import {
  ArrowDown,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChartNoAxesCombined,
  Clock3,
  ExternalLink,
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
  Webhook,
  Zap,
} from 'lucide-react';
import { Logo } from '../components/ui/Logo.js';

const features = [
  {
    icon: RotateCcw,
    title: 'Guaranteed delivery',
    description:
      'Automatic retries with backoff keep temporary receiver outages from becoming lost events.',
    color: 'text-blue-300 bg-blue-400/10 border-blue-400/15',
  },
  {
    icon: ShieldCheck,
    title: 'Request signing',
    description:
      'Verify every delivery with a timestamped HMAC-SHA256 signature generated for your endpoint.',
    color: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/15',
  },
  {
    icon: ChartNoAxesCombined,
    title: 'Real-time monitoring',
    description:
      'See delivery status, response codes, timings, payloads, and attempt history in one clear log.',
    color: 'text-violet-300 bg-violet-400/10 border-violet-400/15',
  },
  {
    icon: Zap,
    title: 'One-click replay',
    description:
      'Inspect a failed request, fix the issue, and replay it from the dashboard in seconds.',
    color: 'text-amber-300 bg-amber-400/10 border-amber-400/15',
  },
];

const plans = [
  {
    name: 'Free',
    price: '$0',
    cadence: 'forever',
    description: 'Start here. Ship with confidence.',
    limit: '10,000 webhooks / month',
    features: ['7-day log history', 'Automatic retries', 'Request signing'],
    highlight: true,
  },
  {
    name: 'Pro',
    price: '$15',
    cadence: 'per month',
    description: 'More room for growing products.',
    limit: '250,000 webhooks / month',
    features: ['30-day log history', 'Failure email alerts', 'Everything in Free'],
    highlight: false,
  },
  {
    name: 'Team',
    price: '$49',
    cadence: 'per month',
    description: 'Control and visibility at scale.',
    limit: '1,000,000 webhooks / month',
    features: ['90-day log history', 'Custom retry schedules', 'Unlimited team members'],
    highlight: false,
  },
];

function EventPreview() {
  return (
    <div className="relative mx-auto w-full max-w-xl">
      <div className="absolute -inset-8 rounded-[2rem] bg-blue-500/10 blur-3xl" />
      <div className="relative overflow-hidden rounded-2xl border border-gray-700/80 bg-[#0d1423] shadow-2xl shadow-black/50">
        <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-red-400/80" />
            <span className="size-2 rounded-full bg-amber-400/80" />
            <span className="size-2 rounded-full bg-emerald-400/80" />
          </div>
          <span className="font-mono text-[10px] text-gray-500">hookrelay / events</span>
          <span className="flex items-center gap-1.5 text-[10px] text-emerald-300">
            <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
            Live
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 border-b border-gray-800 p-3 sm:gap-3 sm:p-4">
          {[
            ['Delivered today', '1,284', 'text-blue-300'],
            ['Successful', '1,271', 'text-emerald-300'],
            ['Needs attention', '13', 'text-amber-300'],
          ].map(([label, value, color]) => (
            <div
              key={label}
              className="rounded-xl border border-gray-800 bg-[#111827] p-2.5 sm:p-3"
            >
              <p className="truncate text-[9px] text-gray-500 sm:text-[10px]">{label}</p>
              <p className={`mt-1 text-lg font-semibold tabular-nums sm:text-xl ${color}`}>
                {value}
              </p>
            </div>
          ))}
        </div>
        <div className="p-2 sm:p-3">
          <div className="hidden grid-cols-[1.1fr_2fr_1fr_1fr] gap-3 px-3 py-2 text-[9px] font-semibold uppercase tracking-wider text-gray-600 sm:grid">
            <span>Status</span>
            <span>Destination</span>
            <span>Response</span>
            <span>Time</span>
          </div>
          {[
            ['Delivered', 'payments.example.com/hooks', '200 OK', '84 ms', 'emerald'],
            ['Retrying', 'orders.example.com/events', '503 Error', '1.2 s', 'amber'],
            ['Delivered', 'accounts.example.com/sync', '204 OK', '126 ms', 'emerald'],
          ].map(([status, target, response, time, color]) => (
            <div
              key={target}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-t border-gray-800/80 px-2 py-3 first:border-0 sm:grid-cols-[1.1fr_2fr_1fr_1fr] sm:gap-3 sm:px-3"
            >
              <span
                className={`flex items-center gap-1.5 text-[10px] ${color === 'emerald' ? 'text-emerald-300' : 'text-amber-300'}`}
              >
                <span
                  className={`size-1.5 rounded-full ${color === 'emerald' ? 'bg-emerald-400' : 'animate-pulse bg-amber-400'}`}
                />
                {status}
              </span>
              <span className="col-span-2 truncate font-mono text-[10px] text-gray-400 sm:col-span-1">
                {target}
              </span>
              <span className="hidden font-mono text-[10px] text-gray-500 sm:block">
                {response}
              </span>
              <span className="text-right font-mono text-[10px] text-gray-500 sm:text-left">
                {time}
              </span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-gray-800 bg-[#111827]/70 px-4 py-3">
          <span className="text-[10px] text-gray-500">
            Retries happen automatically. You stay in control.
          </span>
          <span className="flex items-center gap-1 text-[10px] font-medium text-blue-300">
            View event <ArrowUpRight className="size-3" />
          </span>
        </div>
      </div>
      <div className="absolute -bottom-5 -left-3 flex items-center gap-2 rounded-xl border border-gray-700 bg-[#111827] px-3 py-2 shadow-xl sm:-left-8">
        <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-400/10 text-emerald-300">
          <Check className="size-4" />
        </span>
        <span className="text-[10px] text-gray-300">
          Event delivered <span className="text-gray-500">· just now</span>
        </span>
      </div>
    </div>
  );
}

export function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#0a0f1e] text-gray-100">
      <header className="relative z-10 mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between px-5 sm:px-8">
        <Logo to="/" ariaLabel="HookRelay home" />
        <nav
          aria-label="Main navigation"
          className="hidden items-center gap-7 text-sm text-gray-400 md:flex"
        >
          <a className="transition-colors hover:text-white" href="#how-it-works">
            How it works
          </a>
          <a className="transition-colors hover:text-white" href="#features">
            Features
          </a>
          <a className="transition-colors hover:text-white" href="#pricing">
            Pricing
          </a>
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            to="/login"
            className="rounded-lg px-3 py-2 text-sm font-medium text-gray-300 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            Sign in
          </Link>
          <Link
            to="/register"
            className="rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-950/30 transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 sm:px-4"
          >
            Get started
          </Link>
        </div>
      </header>

      <section className="relative px-5 pb-24 pt-14 sm:px-8 sm:pb-32 sm:pt-20 lg:pt-24">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[38rem] bg-[radial-gradient(ellipse_at_25%_0%,rgba(37,99,235,0.16),transparent_55%)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-[1fr_1.05fr] lg:gap-14">
          <div className="max-w-2xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-400/[0.07] px-3 py-1.5 text-xs font-medium text-blue-200">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-blue-400 opacity-50" />
                <span className="relative size-2 rounded-full bg-blue-400" />
              </span>
              Reliable webhooks, without the busywork
            </div>
            <h1 className="max-w-2xl text-4xl font-semibold leading-[1.08] tracking-[-0.04em] text-white sm:text-5xl lg:text-[4.2rem]">
              Never lose a{' '}
              <span className="bg-gradient-to-r from-blue-300 via-blue-400 to-cyan-300 bg-clip-text text-transparent">
                webhook
              </span>{' '}
              again
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-gray-400 sm:text-lg sm:leading-8">
              HookRelay queues, retries, logs, and lets you replay webhook deliveries. Because
              temporary failures shouldn&apos;t mean lost events.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/register"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-xl shadow-blue-950/40 transition-all hover:-translate-y-0.5 hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                Get Started Free <ArrowRight className="size-4" />
              </Link>
              <Link
                to="/events"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-gray-700 bg-gray-900/70 px-5 text-sm font-semibold text-gray-200 transition-colors hover:border-gray-600 hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                View Dashboard Demo <ArrowUpRight className="size-4 text-gray-400" />
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <Check className="size-3.5 text-emerald-400" /> 10,000 events free
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="size-3.5 text-emerald-400" /> No credit card required
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="size-3.5 text-emerald-400" /> HMAC signed
              </span>
            </div>
          </div>
          <EventPreview />
        </div>
        <a
          href="#how-it-works"
          aria-label="Scroll to how it works"
          className="mx-auto mt-20 flex w-fit flex-col items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-gray-600 hover:text-gray-400"
        >
          Explore HookRelay <ArrowDown className="size-4" />
        </a>
      </section>

      <section
        id="how-it-works"
        className="scroll-mt-8 border-y border-gray-800/70 bg-[#0d1423]/60 px-5 py-20 sm:px-8 sm:py-24"
      >
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-400">
              A reliable path from event to action
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Three steps. Zero lost events.
            </h2>
            <p className="mt-4 text-sm leading-6 text-gray-400 sm:text-base">
              Keep your integration simple while HookRelay handles the messy delivery edge cases.
            </p>
          </div>
          <div className="relative mt-14 grid gap-5 md:grid-cols-3">
            <div className="absolute left-[18%] right-[18%] top-12 hidden border-t border-dashed border-gray-700 md:block" />
            {[
              {
                number: '01',
                title: 'Send',
                text: 'Post your event once with your API key. Get an instant accepted response.',
                icon: Webhook,
              },
              {
                number: '02',
                title: 'Queue & deliver',
                text: 'A durable queue delivers it in the background and retries temporary failures.',
                icon: ArrowDownLeft,
              },
              {
                number: '03',
                title: 'Monitor & replay',
                text: 'See every attempt and response. Replay a failed delivery whenever you need.',
                icon: ChartNoAxesCombined,
              },
            ].map(({ number, title, text, icon: Icon }) => (
              <article
                key={number}
                className="relative rounded-2xl border border-gray-800 bg-[#111827] p-6 sm:p-7"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-gray-600">{number} / 03</span>
                  <span className="flex size-10 items-center justify-center rounded-xl border border-blue-400/15 bg-blue-400/10 text-blue-300">
                    <Icon className="size-5" />
                  </span>
                </div>
                <h3 className="mt-7 text-lg font-semibold text-white">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-gray-400">{text}</p>
              </article>
            ))}
          </div>
          <div className="mt-8 overflow-hidden rounded-2xl border border-gray-800 bg-[#090e19] p-4 sm:p-6">
            <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4">
                <span className="rounded-lg border border-gray-800 bg-[#111827] px-3 py-2 font-mono text-[11px] text-gray-300">
                  Your service
                </span>
                <ArrowRight className="hidden size-4 text-blue-400 sm:block" />
                <span className="rounded-lg border border-blue-400/20 bg-blue-400/[0.08] px-3 py-2 font-mono text-[11px] text-blue-200">
                  HookRelay queue
                </span>
                <ArrowRight className="hidden size-4 text-blue-400 sm:block" />
                <span className="rounded-lg border border-gray-800 bg-[#111827] px-3 py-2 font-mono text-[11px] text-gray-300">
                  Your endpoint
                </span>
              </div>
              <span className="flex items-center gap-2 text-[11px] text-gray-500">
                <LockKeyhole className="size-3.5 text-emerald-400" /> Signed. Tracked. Retried.
              </span>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="scroll-mt-8 px-5 py-20 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div className="max-w-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-400">
                Everything your integration needs
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Resilience built into every delivery.
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-6 text-gray-400">
              Spend less time rebuilding webhook infrastructure and more time on your product.
            </p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(({ icon: Icon, title, description, color }) => (
              <article
                key={title}
                className="group rounded-2xl border border-gray-800 bg-[#111827]/80 p-5 transition-all hover:-translate-y-1 hover:border-gray-700 hover:bg-[#111827]"
              >
                <span
                  className={`flex size-11 items-center justify-center rounded-xl border ${color}`}
                >
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-5 text-sm font-semibold text-white">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-gray-400">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        id="pricing"
        className="scroll-mt-8 border-y border-gray-800/70 bg-[#0d1423]/60 px-5 py-20 sm:px-8 sm:py-24"
      >
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-400">
              Straightforward pricing
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Start free. Scale when you&apos;re ready.
            </h2>
            <p className="mt-4 text-sm leading-6 text-gray-400">
              The reliability you need, with room to grow as your product takes off.
            </p>
          </div>
          <div className="mt-12 grid items-stretch gap-4 lg:grid-cols-3">
            {plans.map((plan) => (
              <article
                key={plan.name}
                className={`relative flex flex-col rounded-2xl border p-6 sm:p-7 ${
                  plan.highlight
                    ? 'border-blue-500/50 bg-gradient-to-b from-blue-500/[0.09] to-[#111827] shadow-xl shadow-blue-950/20'
                    : 'border-gray-800 bg-[#111827]'
                }`}
              >
                {plan.highlight && (
                  <span className="absolute right-5 top-5 rounded-full border border-blue-400/20 bg-blue-400/10 px-2.5 py-1 text-[10px] font-semibold text-blue-200">
                    START HERE
                  </span>
                )}
                <h3 className="text-base font-semibold text-white">{plan.name}</h3>
                <p className="mt-1 min-h-10 text-xs leading-5 text-gray-400">{plan.description}</p>
                <p className="mt-5 flex items-baseline gap-2">
                  <span className="text-4xl font-semibold tracking-tight text-white">
                    {plan.price}
                  </span>
                  <span className="text-xs text-gray-500">{plan.cadence}</span>
                </p>
                <p className="mt-4 border-b border-gray-800 pb-4 text-xs font-medium text-gray-200">
                  {plan.limit}
                </p>
                <ul className="mt-5 flex-1 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2.5 text-xs text-gray-400">
                      <Check className="size-3.5 shrink-0 text-emerald-400" /> {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/register"
                  className={`mt-7 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                    plan.highlight
                      ? 'bg-blue-600 text-white hover:bg-blue-500'
                      : 'border border-gray-700 bg-gray-800 text-gray-200 hover:bg-gray-700'
                  }`}
                >
                  {plan.highlight ? 'Get started free' : `Choose ${plan.name}`}{' '}
                  <ArrowRight className="size-4" />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-8">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-3xl border border-blue-400/20 bg-gradient-to-br from-blue-600/20 via-[#111827] to-[#111827] px-6 py-12 text-center sm:px-12 sm:py-16">
          <div className="pointer-events-none absolute -right-16 -top-28 size-72 rounded-full bg-blue-500/10 blur-3xl" />
          <p className="relative text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">
            Your next delivery is covered
          </p>
          <h2 className="relative mx-auto mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Ship the feature. We&apos;ll handle the retries.
          </h2>
          <p className="relative mx-auto mt-4 max-w-lg text-sm leading-6 text-gray-400">
            Get started in minutes and see every webhook delivery in one place.
          </p>
          <Link
            to="/register"
            className="relative mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
          >
            Create your free account <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-gray-800 px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col items-center gap-2 sm:items-start">
            <Logo />
            <span className="text-[11px] text-gray-600">Built by Zishan Sarkar</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-xs text-gray-500">
            <a
              href="https://github.com/mdzishanSarkar/hookrelay"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 transition-colors hover:text-gray-200"
            >
              <ExternalLink className="size-3.5" /> GitHub <ArrowUpRight className="size-3" />
            </a>
            <a
              href="https://github.com/mdzishanSarkar/hookrelay#api-overview"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 transition-colors hover:text-gray-200"
            >
              API docs <ArrowUpRight className="size-3" />
            </a>
            <a
              href="#pricing"
              className="inline-flex items-center gap-1.5 transition-colors hover:text-gray-200"
            >
              Pricing <ArrowUpRight className="size-3" />
            </a>
          </div>
          <p className="text-center text-[11px] text-gray-600 sm:text-right">
            <Clock3 className="mr-1 inline size-3" /> Reliable delivery, around the clock.
          </p>
        </div>
      </footer>
    </main>
  );
}
