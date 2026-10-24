interface PageShellProps {
  title: string;
  description?: string;
}

export function PageShell({ title, description }: PageShellProps) {
  return (
    <div>
      <div className="mb-7">
        <h1 className="text-2xl font-semibold tracking-tight text-white">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-gray-500">{description}</p>}
      </div>
      <div className="rounded-xl border border-gray-800 bg-[#111827] p-6 text-sm text-gray-500">
        {title} page
      </div>
    </div>
  );
}
