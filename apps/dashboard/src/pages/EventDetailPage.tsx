import { useParams } from 'react-router-dom';
import { PageShell } from './PageShell.js';

export function EventDetailPage() {
  const { id } = useParams();
  return <PageShell title="Event details" description={`Inspect delivery event ${id ?? ''}.`} />;
}
