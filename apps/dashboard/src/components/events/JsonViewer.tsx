import { useState } from 'react';
import { Check, ChevronDown, ChevronRight, Copy } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext.js';

interface JsonViewerProps {
  value: unknown;
  className?: string;
}

function Value({ value }: { value: unknown }) {
  if (value === null) return <span className="text-gray-500">null</span>;
  if (typeof value === 'string') return <span className="text-green-300">"{value}"</span>;
  if (typeof value === 'number') return <span className="text-blue-300">{value}</span>;
  if (typeof value === 'boolean') return <span className="text-amber-300">{String(value)}</span>;
  return <span className="text-gray-400">{String(value)}</span>;
}

function JsonNode({
  value,
  path,
  depth,
  line,
  collapsed,
  toggle,
  isLast = true,
}: {
  value: unknown;
  path: string;
  depth: number;
  line: { current: number };
  collapsed: Set<string>;
  toggle(path: string): void;
  isLast?: boolean;
}) {
  const isArray = Array.isArray(value);
  const isObject = value !== null && typeof value === 'object' && !isArray;
  if (!isArray && !isObject) {
    const lineNumber = line.current++;
    return (
      <div className="flex min-h-6">
        <span className="w-10 shrink-0 select-none pr-3 text-right text-gray-700">{lineNumber}</span>
        <Value value={value} />
      </div>
    );
  }

  const entries = Object.entries(value as Record<string, unknown>);
  const isCollapsed = collapsed.has(path);
  const opening = isArray ? '[' : '{';
  const closing = isArray ? ']' : '}';
  const startLine = line.current++;

  return (
    <>
      <div className="flex min-h-6 items-center">
        <span className="w-10 shrink-0 select-none pr-3 text-right text-gray-700">{startLine}</span>
        <button
          type="button"
          aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${isArray ? 'array' : 'object'}`}
          onClick={() => toggle(path)}
          className="mr-1 rounded text-gray-500 hover:text-white"
        >
          {isCollapsed ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </button>
        <span className="text-gray-400">{opening}</span>
        {isCollapsed && (
          <>
            <span className="ml-1 text-gray-600">…</span>
            <span className="ml-1 text-gray-400">{closing}</span>
          </>
        )}
      </div>
      {!isCollapsed &&
        entries.map(([key, child], index) => {
          const childPath = `${path}.${key}`;
          const childIsContainer = child !== null && typeof child === 'object';
          return (
            <div key={childPath} style={{ paddingLeft: `${(depth + 1) * 16}px` }}>
              <div className="flex min-h-6">
                <span className="w-10 shrink-0 select-none pr-3 text-right text-gray-700">
                  {line.current++}
                </span>
                {!isArray && <span className="text-gray-200">"{key}"</span>}
                {!isArray && <span className="mr-2 text-gray-500">:</span>}
                {childIsContainer ? (
                  <JsonNode
                    value={child}
                    path={childPath}
                    depth={depth + 1}
                    line={line}
                    collapsed={collapsed}
                    toggle={toggle}
                    isLast={index === entries.length - 1}
                  />
                ) : (
                  <>
                    <Value value={child} />
                    {index < entries.length - 1 && <span className="text-gray-500">,</span>}
                  </>
                )}
              </div>
            </div>
          );
        })}
      {!isCollapsed && (
        <div className="flex min-h-6">
          <span className="w-10 shrink-0 select-none pr-3 text-right text-gray-700">{line.current++}</span>
          <span className="text-gray-400">{closing}</span>
          {!isLast && <span className="text-gray-500">,</span>}
        </div>
      )}
    </>
  );
}

export function JsonViewer({ value, className = '' }: JsonViewerProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const toggle = (path: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(value, null, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast('Could not copy JSON to the clipboard.', 'error');
    }
  };

  return (
    <div className={`overflow-hidden rounded-lg border border-gray-800 bg-[#0a0f1e] ${className}`}>
      <div className="flex items-center justify-between border-b border-gray-800 px-3 py-2">
        <span className="text-xs text-gray-500">JSON</span>
        <button
          type="button"
          onClick={() => void copy()}
          className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="max-h-[32rem] overflow-auto py-3 font-mono text-xs leading-6">
        <JsonNode
          value={value}
          path="$"
          depth={0}
          line={{ current: 1 }}
          collapsed={collapsed}
          toggle={toggle}
        />
      </pre>
    </div>
  );
}
