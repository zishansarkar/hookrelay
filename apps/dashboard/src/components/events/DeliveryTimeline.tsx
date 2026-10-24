import { useState } from 'react';
import { ChevronDown, ChevronRight, CircleAlert, Clock3 } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import type { DeliveryAttempt } from '@hookrelay/shared';
import { Badge } from '../ui/Badge.js';
import { JsonViewer } from './JsonViewer.js';

interface DeliveryTimelineProps {
  attempts: DeliveryAttempt[];
  retryPending?: boolean;
}

function responseBody(body: string): { value: unknown; isJson: boolean } {
  try {
    return { value: JSON.parse(body) as unknown, isJson: true };
  } catch {
    return { value: body, isJson: false };
  }
}

export function DeliveryTimeline({ attempts, retryPending = false }: DeliveryTimelineProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [showFullBody, setShowFullBody] = useState<Set<string>>(() => new Set());
  const toggle = (id: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (!attempts.length) {
    return <p className="text-sm text-gray-500">No delivery attempts have been recorded.</p>;
  }

  return (
    <ol className="space-y-0">
      {attempts.map((attempt, index) => {
        const isOpen = expanded.has(attempt.id);
        const success =
          attempt.statusCode !== null && attempt.statusCode >= 200 && attempt.statusCode < 300;
        const pending = !success && !attempt.error && attempt.statusCode === null;
        const waitingForRetry = retryPending && index === attempts.length - 1 && !success;
        const color = success
          ? 'bg-green-500'
          : pending || waitingForRetry
            ? 'bg-amber-400'
            : 'bg-red-500';
        const parsedBody = attempt.responseBody ? responseBody(attempt.responseBody) : null;
        return (
          <li key={attempt.id} className="relative flex gap-3 pb-5 last:pb-0">
            {index < attempts.length - 1 && (
              <span className="absolute bottom-0 left-[7px] top-4 w-px bg-gray-800" />
            )}
            <span className={`relative mt-1.5 size-3 shrink-0 rounded-full ring-4 ring-[#111827] ${color}`} />
            <div className="min-w-0 flex-1">
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => toggle(attempt.id)}
                className="flex w-full flex-wrap items-center gap-2 text-left"
              >
                {isOpen ? (
                  <ChevronDown className="size-4 text-gray-500" />
                ) : (
                  <ChevronRight className="size-4 text-gray-500" />
                )}
                <span className="text-sm font-medium text-white">Attempt #{attempt.attemptNumber}</span>
                {attempt.statusCode === null ? (
                  <Badge variant="failed">
                    {attempt.error ? 'Connection error' : 'No response'}
                  </Badge>
                ) : (
                  <Badge variant={success ? 'success' : 'failed'}>HTTP {attempt.statusCode}</Badge>
                )}
                {attempt.responseTimeMs !== null && (
                  <span className="text-xs text-gray-500">{attempt.responseTimeMs} ms</span>
                )}
              </button>
              <time
                dateTime={new Date(attempt.createdAt).toISOString()}
                title={format(new Date(attempt.createdAt), 'PPpp')}
                className="ml-6 mt-1 block text-xs text-gray-500"
              >
                {formatDistanceToNow(new Date(attempt.createdAt), { addSuffix: true })}
              </time>

              {isOpen && (
                <div className="ml-6 mt-3 space-y-4 rounded-lg border border-gray-800 bg-[#0a0f1e] p-3">
                  {attempt.responseHeaders && Object.keys(attempt.responseHeaders).length > 0 && (
                    <div>
                      <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                        Response headers
                      </h4>
                      <div className="space-y-1">
                        {Object.entries(attempt.responseHeaders).map(([name, value]) => (
                          <div key={name} className="grid grid-cols-[minmax(7rem,auto)_1fr] gap-3 text-xs">
                            <span className="break-all text-gray-400">{name}</span>
                            <span className="break-all font-mono text-gray-200">{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {parsedBody && (
                    <div>
                      <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                        Response body
                      </h4>
                      {parsedBody.isJson &&
                      ((attempt.responseBody?.length ?? 0) <= 10 * 1024 ||
                        showFullBody.has(attempt.id)) ? (
                        <JsonViewer value={parsedBody.value} />
                      ) : (
                        <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded bg-[#111827] p-3 font-mono text-xs text-gray-300">
                          {attempt.responseBody &&
                          (showFullBody.has(attempt.id) || attempt.responseBody.length <= 10 * 1024)
                            ? attempt.responseBody
                            : `${attempt.responseBody?.slice(0, 10 * 1024) ?? ''}…`}
                        </pre>
                      )}
                      {typeof parsedBody.value === 'string' && parsedBody.value.length > 10 * 1024 && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowFullBody((current) => {
                              const next = new Set(current);
                              if (next.has(attempt.id)) next.delete(attempt.id);
                              else next.add(attempt.id);
                              return next;
                            });
                          }}
                          className="mt-2 text-xs font-medium text-blue-300 hover:text-blue-200"
                        >
                          {showFullBody.has(attempt.id) ? 'Show less' : 'Show full'}
                        </button>
                      )}
                    </div>
                  )}
                  {attempt.error && (
                    <p className="flex items-start gap-2 text-xs text-red-300">
                      <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
                      {attempt.error}
                    </p>
                  )}
                  {!attempt.error && !attempt.responseBody && !attempt.responseHeaders && (
                    <p className="flex items-center gap-2 text-xs text-gray-500">
                      <Clock3 className="size-3.5" /> No additional response details were captured.
                    </p>
                  )}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
