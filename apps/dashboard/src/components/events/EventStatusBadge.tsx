import { CircleDashed, CircleCheck, CircleX, Clock3, Skull } from 'lucide-react';
import { DeliveryStatus } from '@hookrelay/shared';
import { Badge } from '../ui/Badge.js';

interface EventStatusBadgeProps {
  status: DeliveryStatus;
}

const statusConfig = {
  [DeliveryStatus.SUCCESS]: { label: 'Success', variant: 'success' as const, Icon: CircleCheck },
  [DeliveryStatus.PENDING]: { label: 'Pending', variant: 'pending' as const, Icon: Clock3 },
  [DeliveryStatus.QUEUED]: { label: 'Pending', variant: 'pending' as const, Icon: Clock3 },
  [DeliveryStatus.DELIVERING]: {
    label: 'Delivering',
    variant: 'pending' as const,
    Icon: CircleDashed,
  },
  [DeliveryStatus.FAILED]: { label: 'Failed', variant: 'failed' as const, Icon: CircleX },
  [DeliveryStatus.DEAD_LETTER]: {
    label: 'Dead letter',
    variant: 'dead-letter' as const,
    Icon: Skull,
  },
};

export function EventStatusBadge({ status }: EventStatusBadgeProps) {
  const config = statusConfig[status];
  const { Icon } = config;
  return (
    <Badge variant={config.variant} className={`gap-1.5 whitespace-nowrap ${config.label === 'Pending' ? 'animate-pulse' : ''}`}>
      <Icon className="size-3.5" aria-hidden="true" />
      {config.label}
    </Badge>
  );
}
