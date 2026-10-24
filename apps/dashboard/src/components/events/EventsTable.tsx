import { EventRow } from './EventRow.js';
import type { ListedWebhookEvent } from '../../lib/api.js';
import { EmptyState } from '../ui/EmptyState.js';
import { Spinner } from '../ui/Spinner.js';
import { Button } from '../ui/Button.js';
import { Code2, Copy } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext.js';

interface EventsTableProps {
  events: ListedWebhookEvent[];
  isLoading: boolean;
  isFetching: boolean;
}

const columns = [
  'Status',
  'Event ID',
  'Target URL',
  'Method',
  'Response',
  'Duration',
  'Attempts',
  'Created',
];

function LoadingRows() {
  return (
    <div role="status" className="divide-y divide-gray-800/80" aria-label="Loading events">
      {Array.from({ length: 7 }, (_, index) => (
        <div key={index} className="grid grid-cols-4 items-center gap-4 px-4 py-4 sm:grid-cols-8">
          {Array.from({ length: 8 }, (_, cellIndex) => (
            <div
              key={cellIndex}
              className={`h-4 animate-shimmer rounded bg-[linear-gradient(100deg,#1f2937_20%,#374151_38%,#1f2937_56%)] bg-[length:200%_100%] ${
                cellIndex === 2 ? 'col-span-2 sm:col-span-1' : ''
              }`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function EventsTable({ events, isLoading, isFetching }: EventsTableProps) {
  const { toast } = useToast();
  const example = `curl -X POST "$API_URL/v1/webhooks/send" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"targetUrl":"https://example.com/webhook","payload":{"type":"order.paid"}}'`;
  const copyExample = async () => {
    try {
      await navigator.clipboard.writeText(example);
      toast('Example copied to clipboard.', 'success');
    } catch {
      toast('Could not copy the example.', 'error');
    }
  };

  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-xl border border-gray-800 bg-[#111827]">
        <LoadingRows />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <EmptyState
        title="No events yet"
        message="Send your first webhook using the API. Your delivery activity will show up here."
        icon={<Code2 className="size-6" />}
        action={
          <div className="w-full max-w-xl text-left">
            <div className="relative rounded-lg border border-gray-800 bg-[#0a0f1e] p-3 pr-12">
              <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-5 text-gray-300">{example}</pre>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Copy example request"
                onClick={() => void copyExample()}
                className="absolute right-2 top-2 px-2"
              >
                <Copy className="size-3.5" />
              </Button>
            </div>
          </div>
        }
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-800 bg-[#111827]">
      {isFetching && (
        <div className="flex items-center justify-end gap-2 border-b border-gray-800 px-4 py-2 text-[11px] text-gray-500">
          <Spinner className="size-3 text-blue-400" />
          Updating
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1050px] border-collapse text-left">
          <thead className="border-b border-gray-800 bg-[#0e1524]">
            <tr>
              {columns.map((column) => (
                <th
                  key={column}
                  scope="col"
                  className="whitespace-nowrap px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
