import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { eventsApi, type EventListParams } from '../lib/api.js';

export interface EventsFilters extends EventListParams {
  page: number;
  limit: number;
}

export function useEvents(filters: EventsFilters) {
  return useQuery({
    queryKey: ['events', filters],
    queryFn: () => eventsApi.listEvents(filters),
    placeholderData: keepPreviousData,
    staleTime: 10_000,
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });
}

export function useEventStats() {
  return useQuery({
    queryKey: ['events', 'stats'],
    queryFn: eventsApi.getStats,
    staleTime: 10_000,
    refetchInterval: 5_000,
  });
}
