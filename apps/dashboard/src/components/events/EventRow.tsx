import { useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { Check, Copy, ExternalLink, RotateCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import type { ListedWebhookEvent } from '../../lib/api.js';
import { DeliveryStatus } from '@hookrelay/shared';
import { useReplayEvent } from '../../hooks/useEvent.js';
import { useToast } from '../../contexts/ToastContext.js';
import { Spinner } from '../ui/Spinner.js';
import { EventStatusBadge } from './EventStatusBadge.js';

interface EventRowProps {
  event: ListedWebhookEvent;
}

function responseCodeColor(statusCode: number | null): string {
  if (statusCode === null) return 'text-gray-600';
  if (statusCode >= 200 && statusCode < 300) return 'text-green-400';
  if (statusCode >= 400 && statusCode < 500) return 'text-amber-400';
  if (statusCode >= 500) return 'text-red-400';
  return 'text-gray-400';
}

function responseTimeColor(responseTimeMs: number | null): string {
  if (responseTimeMs === null) return 'text-gray-600';
  if (responseTimeMs < 500) return 'text-green-400';
  if (responseTimeMs <= 2_000) return 'text-amber-400';
  return 'text-red-400';
}

export function EventRow({ event }: EventRowProps) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);
  const createdAt = new Date(event.createdAt);
  const replayMutation = useReplayEvent(event.id);
  const { toast } = useToast();

  async function copyEventId(eventClick: React.MouseEvent<HTMLButtonElement>) {
    eventClick.stopPropagation();
    try {
      await navigator.clipboard.writeText(event.id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
      toast('Could not copy the event ID.', 'error');
    }
  }

  async function copyTargetUrl(eventClick: React.MouseEvent<HTMLButtonElement>) {
    eventClick.stopPropagation();
    try {
      await navigator.clipboard.writeText(event.targetUrl);
      setUrlCopied(true);
      window.setTimeout(() => setUrlCopied(false), 1500);
    } catch {
      toast('Could not copy the target URL.', 'error');
    }
  }

  async function replay(eventClick: React.MouseEvent<HTMLButtonElement>) {
    eventClick.stopPropagation();
    try {
      await replayMutation.mutateAsync();
      toast('Event replayed successfully.', 'success');
    } catch {
      toast('Could not replay this event. Please try again.', 'error');
    }
  }

  function openDetails() {
    navigate(`/events/${encodeURIComponent(event.id)}`);
  }

  return (
    <tr
      tabIndex={0}
      onClick={openDetails}
      onKeyDown={(keyEvent) => {
        if (keyEvent.target !== keyEvent.currentTarget) return;
        if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
          keyEvent.preventDefault();
          openDetails();
        }
      }}
      className="group cursor-pointer border-b border-gray-800/80 transition-colors last:border-0 hover:bg-gray-800/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
    >
      <td className="whitespace-nowrap px-4 py-3.5">
        <EventStatusBadge status={event.status} />
      </td>
      <td className="px-4 py-3.5">
        <button
          type="button"
          onClick={copyEventId}
          title="Copy full event ID"
          className="inline-flex max-w-36 items-center gap-1.5 rounded text-left font-mono text-xs text-gray-400 hover:text-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          <span className="truncate">{event.id}</span>
          {copied ? (
            <Check className="size-3 shrink-0 text-green-400" />
          ) : (
            <Copy className="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
          )}
        </button>
      </td>
      <td className="max-w-64 px-4 py-3.5">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm text-gray-300" title={event.targetUrl}>
            {event.targetUrl}
          </span>
          <button
            type="button"
            aria-label={urlCopied ? 'Target URL copied' : 'Copy target URL'}
            title={urlCopied ? 'Copied' : 'Copy target URL'}
            onClick={copyTargetUrl}
            className="shrink-0 rounded p-1 text-gray-500 opacity-0 transition-opacity hover:text-blue-300 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 group-hover:opacity-100"
          >
            {urlCopied ? <Check className="size-3.5 text-green-400" /> : <Copy className="size-3.5" />}
          </button>
          <ExternalLink className="size-3 shrink-0 text-gray-700" aria-hidden="true" />
        </span>
      </td>
      <td className="whitespace-nowrap px-4 py-3.5">
        <span className="rounded-md border border-gray-800 bg-gray-900 px-2 py-1 font-mono text-[10px] font-semibold text-gray-400">
          {event.httpMethod}
        </span>
      </td>
      <td
        className={clsx(
          'whitespace-nowrap px-4 py-3.5 font-mono text-xs',
          responseCodeColor(event.responseCode),
        )}
      >
        {event.responseCode ?? '—'}
      </td>
      <td
        className={clsx(
          'whitespace-nowrap px-4 py-3.5 font-mono text-xs',
          responseTimeColor(event.responseTimeMs),
        )}
      >
        {event.responseTimeMs === null ? '—' : `${event.responseTimeMs}ms`}
      </td>
      <td className="whitespace-nowrap px-4 py-3.5 text-xs text-gray-400">
        {event.attempts}/{event.maxRetries}
      </td>
      <td className="whitespace-nowrap px-4 py-3.5 text-xs text-gray-500">
        <span className="flex items-center justify-between gap-3">
          <time dateTime={createdAt.toISOString()} title={format(createdAt, 'PPpp')}>
            {formatDistanceToNow(createdAt, { addSuffix: true })}
          </time>
          {(event.status === DeliveryStatus.FAILED || event.status === DeliveryStatus.DEAD_LETTER) && (
            <button
              type="button"
              aria-label="Replay event"
              title="Replay event"
              disabled={replayMutation.isPending}
              onClick={(clickEvent) => void replay(clickEvent)}
              className="rounded-md p-1.5 text-gray-500 hover:bg-blue-500/10 hover:text-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:opacity-50"
            >
              {replayMutation.isPending ? (
                <Spinner className="size-3.5" />
              ) : (
                <RotateCw className="size-3.5" />
              )}
            </button>
          )}
        </span>
      </td>
    </tr>
  );
}
