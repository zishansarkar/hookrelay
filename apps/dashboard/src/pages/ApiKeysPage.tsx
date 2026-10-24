import { useState, type FormEvent } from 'react';
import { Check, Copy, KeyRound, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import type { ApiKey } from '@hookrelay/shared';
import { EmptyState } from '../components/ui/EmptyState.js';
import { Input } from '../components/ui/Input.js';
import { Modal } from '../components/ui/Modal.js';
import { Button } from '../components/ui/Button.js';
import { Badge } from '../components/ui/Badge.js';
import { Card } from '../components/ui/Card.js';
import { ErrorState } from '../components/ui/ErrorState.js';
import { Skeleton } from '../components/ui/Skeleton.js';
import { useToast } from '../contexts/ToastContext.js';
import { useApiKeys, useCreateApiKey, useRevokeApiKey } from '../hooks/useApiKeys.js';

type DialogState =
  | { type: 'create' }
  | { type: 'created'; name: string; rawKey: string }
  | { type: 'revoke'; apiKey: ApiKey }
  | null;

export function ApiKeysPage() {
  const { data: apiKeys, isLoading, isError, error, refetch } = useApiKeys();
  const createMutation = useCreateApiKey();
  const revokeMutation = useRevokeApiKey();
  const { toast } = useToast();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const [copied, setCopied] = useState(false);

  const closeDialog = () => {
    if (createMutation.isPending || revokeMutation.isPending) return;
    setDialog(null);
    setName('');
    setNameError('');
    setCopied(false);
  };

  const createKey = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Enter a name for this API key.');
      return;
    }
    if (trimmed.length > 100) {
      setNameError('Key names must be 100 characters or fewer.');
      return;
    }
    setNameError('');
    try {
      const result = await createMutation.mutateAsync(trimmed);
      setDialog({ type: 'created', name: result.apiKey.name, rawKey: result.rawKey });
      setName('');
    } catch {
      toast('Could not create an API key. Please try again.', 'error');
    }
  };

  const revokeKey = async (apiKey: ApiKey) => {
    try {
      await revokeMutation.mutateAsync(apiKey.id);
      setDialog(null);
      toast(`${apiKey.name} was revoked.`, 'success');
    } catch {
      toast('Could not revoke this API key. Please try again.', 'error');
    }
  };

  const copyKey = async () => {
    if (dialog?.type !== 'created') return;
    try {
      await navigator.clipboard.writeText(dialog.rawKey);
      setCopied(true);
      toast('API key copied to clipboard.', 'success');
    } catch {
      toast('Could not copy the API key. You can select and copy it manually.', 'error');
    }
  };

  const activeCount = apiKeys?.filter((key) => key.isActive).length ?? 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-blue-400">
            Developer settings
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-white">API Keys</h1>
          <p className="mt-1.5 max-w-2xl text-sm text-gray-500">
            API keys are used to authenticate webhook send requests. Keep them secret.
          </p>
        </div>
        <Button
          onClick={() => {
            createMutation.reset();
            setDialog({ type: 'create' });
          }}
          disabled={activeCount >= 5}
          title={activeCount >= 5 ? 'You can have at most 5 active API keys' : undefined}
        >
          <Plus className="size-4" /> Create New Key
        </Button>
      </header>

      <div className="flex items-center gap-2 text-xs text-gray-500">
        <ShieldCheck className="size-4 text-blue-400" />
        {activeCount} of 5 active keys
      </div>

      {isLoading ? (
        <div role="status" aria-label="Loading API keys" className="space-y-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} variant="card" className="h-28" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState
          title="Could not load API keys"
          message={error instanceof Error ? error.message : 'Please try again.'}
          onRetry={() => void refetch()}
        />
      ) : apiKeys?.length ? (
        <div className="grid gap-3">
          {apiKeys.map((apiKey) => (
            <ApiKeyCard
              key={apiKey.id}
              apiKey={apiKey}
              onRevoke={() => setDialog({ type: 'revoke', apiKey })}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No API keys yet"
          message="Create your first key to start sending webhooks."
          icon={<KeyRound className="size-6" />}
          action={
            <Button onClick={() => setDialog({ type: 'create' })}>
              <Plus className="size-4" /> Create your first key
            </Button>
          }
        />
      )}

      <Modal
        open={dialog?.type === 'create'}
        title="Create API key"
        onClose={closeDialog}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={closeDialog} disabled={createMutation.isPending}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="create-api-key-form"
              loading={createMutation.isPending}
            >
              Create key
            </Button>
          </div>
        }
      >
        <form id="create-api-key-form" onSubmit={(event) => void createKey(event)} className="space-y-4">
          <p className="text-sm text-gray-400">
            Give this key a name to help you identify where it is used.
          </p>
          <Input
            autoFocus
            label="Key name"
            name="keyName"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setNameError('');
            }}
            placeholder="e.g. Production server"
            maxLength={100}
            error={nameError}
          />
        </form>
      </Modal>

      <Modal
        open={dialog?.type === 'created'}
        title="Your new API key"
        onClose={closeDialog}
        footer={
          <div className="flex justify-end">
            <Button onClick={closeDialog}>
              <Check className="size-4" /> I&apos;ve copied my key
            </Button>
          </div>
        }
      >
        {dialog?.type === 'created' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-300">
              Key <span className="font-medium text-white">{dialog.name}</span> is ready to use.
            </p>
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3">
              <p className="mb-2 text-xs font-medium text-blue-200">
                Copy this key now. You won&apos;t be able to see it again.
              </p>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 break-all font-mono text-sm text-white">
                  {dialog.rawKey}
                </code>
                <Button variant="secondary" size="sm" onClick={() => void copyKey()}>
                  {copied ? <Check className="size-4 text-green-400" /> : <Copy className="size-4" />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={dialog?.type === 'revoke'}
        title="Revoke API key"
        onClose={closeDialog}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={closeDialog} disabled={revokeMutation.isPending}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={revokeMutation.isPending}
              onClick={() => {
                if (dialog?.type === 'revoke') void revokeKey(dialog.apiKey);
              }}
            >
              <Trash2 className="size-4" /> Revoke key
            </Button>
          </div>
        }
      >
        {dialog?.type === 'revoke' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-300">
              Revoke <span className="font-medium text-white">{dialog.apiKey.name}</span>?
            </p>
            <p className="text-sm text-gray-500">
              This will immediately disable the key. Any requests using this key will be rejected.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}

function ApiKeyCard({ apiKey, onRevoke }: { apiKey: ApiKey; onRevoke(): void }) {
  return (
    <Card className={`space-y-4 ${!apiKey.isActive ? 'opacity-70' : ''}`}>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2
              className={`truncate text-sm font-semibold text-white ${
                !apiKey.isActive ? 'line-through decoration-gray-500' : ''
              }`}
            >
              {apiKey.name}
            </h2>
            <Badge variant={apiKey.isActive ? 'success' : 'neutral'}>
              {apiKey.isActive ? 'Active' : 'Revoked'}
            </Badge>
          </div>
          <code className="mt-2 block break-all font-mono text-xs text-gray-400">
            {apiKey.keyPrefix}
          </code>
        </div>
        {apiKey.isActive && (
          <Button variant="danger" size="sm" onClick={onRevoke} className="self-start">
            <Trash2 className="size-3.5" /> Revoke
          </Button>
        )}
      </div>
      <div className="grid gap-3 border-t border-gray-800 pt-3 text-xs sm:grid-cols-2">
        <p className="text-gray-500">
          Created <span className="ml-1 text-gray-300">{format(new Date(apiKey.createdAt), 'PP')}</span>
        </p>
        <p className="text-gray-500">
          Last used{' '}
          <span className="ml-1 text-gray-300">
            {apiKey.lastUsedAt ? format(new Date(apiKey.lastUsedAt), 'PPp') : 'Never used'}
          </span>
        </p>
      </div>
    </Card>
  );
}
