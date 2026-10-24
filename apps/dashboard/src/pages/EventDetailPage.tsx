import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Copy, ExternalLink, RotateCw } from 'lucide-react';
import { DeliveryStatus } from '@hookrelay/shared';
import { format, formatDistanceToNow } from 'date-fns';
import { DeliveryTimeline } from '../components/events/DeliveryTimeline.js';
import { EventStatusBadge } from '../components/events/EventStatusBadge.js';
import { JsonViewer } from '../components/events/JsonViewer.js';
import { Button } from '../components/ui/Button.js';
import { Card } from '../components/ui/Card.js';
import { Modal } from '../components/ui/Modal.js';
import { ErrorState } from '../components/ui/ErrorState.js';
import { PageSkeleton } from '../components/ui/Skeleton.js';
import { useToast } from '../contexts/ToastContext.js';
import { useEvent, useReplayEvent } from '../hooks/useEvent.js';
import type { DeliveryAttempt } from '@hookrelay/shared';

type RequestTab = 'headers' | 'payload';

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast(`Could not copy ${label.toLowerCase()}.`, 'error');
    }
  };
  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={`Copy ${label}`}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-md p-1.5 text-xs text-gray-500 hover:bg-gray-800 hover:text-white"
    >
      {copied ? <Check className="size-3.5 text-green-400" /> : <Copy className="size-3.5" />}
      <span>{copied ? 'Copied' : 'Copy'}</span>
    </button>
  );
}

function HeaderTable({ headers }: { headers: Record<string, string> }) {
  const entries = Object.entries(headers);
  if (!entries.length) {
    return <p className="text-sm text-gray-500">No request headers were captured.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-gray-800 text-gray-500">
            <th className="py-2 pr-4 font-medium">Header</th>
            <th className="py-2 font-medium">Value</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([name, value]) => (
            <tr key={name} className="border-b border-gray-800/70 last:border-0">
              <td className="max-w-48 break-all py-2 pr-4 font-medium text-gray-300">{name}</td>
              <td className="break-all py-2 font-mono text-gray-400">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProgressDots({ attempts, maxRetries }: { attempts: number; maxRetries: number }) {
  const total = Math.max(1, maxRetries);
  const filled = Math.min(attempts, total);
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-300">
        {attempts} of {total}
      </span>
      <div className="flex items-center gap-1" aria-label={`${attempts} of ${total} attempts`}>
        {Array.from({ length: total }, (_, index) => (
          <span
            key={index}
            className={`size-1.5 rounded-full ${index < filled ? 'bg-blue-400' : 'bg-gray-700'}`}
          />
        ))}
      </div>
    </div>
  );
}

function AttemptRequestHeaders({ attempts, fallback }: {
  attempts: DeliveryAttempt[];
  fallback: Record<string, string>;
}) {
  const latestWithHeaders = [...attempts].reverse().find((attempt) => attempt.requestHeaders);
  const headers = latestWithHeaders?.requestHeaders ?? fallback;
  return (
    <div className="space-y-3">
      <HeaderTable headers={headers} />
      {!latestWithHeaders && (
        <p className="text-xs text-gray-600">
          Full signed request headers are captured once a delivery attempt starts.
        </p>
      )}
    </div>
  );
}

export function EventDetailPage() {
  const { id = '' } = useParams();
  const { data: event, isLoading, isError, error, refetch } = useEvent(id);
  const replayMutation = useReplayEvent(id);
  const { toast } = useToast();
  const [requestTab, setRequestTab] = useState<RequestTab>('payload');
  const [replayOpen, setReplayOpen] = useState(false);

  const confirmReplay = async () => {
    try {
      await replayMutation.mutateAsync();
      setReplayOpen(false);
      toast('Event replayed successfully', 'success');
    } catch {
      toast('Could not replay this event. Please try again.', 'error');
    }
  };

  if (isLoading) {
    return <PageSkeleton />;
  }
  if (isError || !event) {
    return (
      <div className="space-y-4">
        <Link to="/events" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white">
          <ArrowLeft className="size-4" /> Events
        </Link>
        <ErrorState
          title="Unable to load event"
          message={error instanceof Error ? error.message : 'The event could not be found.'}
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  const createdAt = new Date(event.createdAt);
  const canReplay =
    event.status === DeliveryStatus.FAILED || event.status === DeliveryStatus.DEAD_LETTER;
  const lastAttempt = event.deliveryAttempts[event.deliveryAttempts.length - 1];
  const payloadPreview = JSON.stringify(event.payload, null, 2) ?? String(event.payload);

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <Link
            to="/events"
            className="mb-3 inline-flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-white"
          >
            <ArrowLeft className="size-4" /> Events
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="max-w-full break-all font-mono text-lg font-semibold text-white sm:text-xl">
              {event.id}
            </h1>
            <EventStatusBadge status={event.status} />
          </div>
        </div>
        {canReplay && (
          <Button onClick={() => setReplayOpen(true)} className="self-start sm:self-auto">
            <RotateCw className="size-4" /> Replay
          </Button>
        )}
      </header>

      <div className="grid items-start gap-5 xl:grid-cols-3">
        <Card className="space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-white">Event Info</h2>
            <p className="mt-1 text-xs text-gray-500">Request metadata and delivery status.</p>
          </div>
          <div className="space-y-4">
            <div>
              <p className="mb-1.5 text-xs text-gray-500">Target URL</p>
              <div className="flex items-start gap-1 rounded-lg border border-gray-800 bg-[#0a0f1e] p-2">
                <a
                  href={event.targetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 flex-1 break-all text-sm text-blue-300 hover:text-blue-200"
                >
                  {event.targetUrl}
                  <ExternalLink className="ml-1 inline size-3.5" />
                </a>
                <CopyButton value={event.targetUrl} label="target URL" />
              </div>
            </div>
            <InfoRow label="HTTP Method" value={event.httpMethod} />
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs text-gray-500">Status</span>
              <EventStatusBadge status={event.status} />
            </div>
            <div>
              <p className="text-xs text-gray-500">Created</p>
              <time dateTime={createdAt.toISOString()} title={format(createdAt, 'PPpp')}>
                <span className="mt-1 block text-sm text-gray-200">{format(createdAt, 'PPpp')}</span>
                <span className="mt-0.5 block text-xs text-gray-500">
                  {formatDistanceToNow(createdAt, { addSuffix: true })}
                </span>
              </time>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs text-gray-500">Attempts</span>
              <ProgressDots attempts={event.attempts} maxRetries={event.maxRetries} />
            </div>
          </div>
        </Card>

        <Card className="min-w-0 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-white">Request</h2>
            <p className="mt-1 text-xs text-gray-500">Inspect the outgoing headers and payload.</p>
          </div>
          <div className="flex gap-1 border-b border-gray-800">
            {(['headers', 'payload'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setRequestTab(tab)}
                className={`border-b-2 px-3 py-2 text-xs font-medium capitalize ${
                  requestTab === tab
                    ? 'border-blue-400 text-blue-300'
                    : 'border-transparent text-gray-500 hover:text-gray-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          {requestTab === 'headers' ? (
            <AttemptRequestHeaders attempts={event.deliveryAttempts} fallback={event.headers} />
          ) : (
            <JsonViewer value={event.payload} />
          )}
        </Card>

        <Card className="min-w-0 space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-white">Delivery Attempts</h2>
            <p className="mt-1 text-xs text-gray-500">
              {event.deliveryAttempts.length} {event.deliveryAttempts.length === 1 ? 'attempt' : 'attempts'} recorded
              {lastAttempt?.responseTimeMs !== null && lastAttempt?.responseTimeMs !== undefined
                ? ` · latest ${lastAttempt.responseTimeMs} ms`
                : ''}
            </p>
          </div>
          <DeliveryTimeline
            attempts={event.deliveryAttempts}
            retryPending={
              event.status === DeliveryStatus.PENDING || event.status === DeliveryStatus.QUEUED
            }
          />
        </Card>
      </div>

      <Modal
        open={replayOpen}
        title="Replay webhook event"
        onClose={() => setReplayOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setReplayOpen(false)} disabled={replayMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={() => void confirmReplay()} loading={replayMutation.isPending}>
              <RotateCw className="size-4" /> Replay
            </Button>
          </div>
        }
      >
        <p className="text-sm text-gray-300">Are you sure you want to replay this event?</p>
        <div className="mt-4 space-y-3 rounded-lg border border-gray-800 bg-[#0a0f1e] p-3">
          <div>
            <p className="text-xs text-gray-500">Target URL</p>
            <p className="mt-1 break-all text-sm text-gray-200">{event.targetUrl}</p>
          </div>
          <div>
            <p className="mb-1 text-xs text-gray-500">Payload preview</p>
            <pre className="max-h-36 overflow-auto whitespace-pre-wrap break-words rounded bg-[#111827] p-2 font-mono text-xs text-gray-300">
              {payloadPreview}
            </pre>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="rounded bg-gray-800 px-2 py-1 font-mono text-xs text-gray-200">{value}</span>
    </div>
  );
}
