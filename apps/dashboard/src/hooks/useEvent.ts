import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { eventsApi } from '../lib/api.js';

export function useEvent(eventId: string) {
  return useQuery({
    queryKey: ['events', 'detail', eventId],
    queryFn: () => eventsApi.getEvent(eventId),
    enabled: Boolean(eventId),
    staleTime: 10_000,
  });
}

export function useReplayEvent(eventId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => eventsApi.replayEvent(eventId),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['events', 'detail', eventId] });
      const previous = queryClient.getQueryData(['events', 'detail', eventId]);
      queryClient.setQueryData(['events', 'detail', eventId], (current: unknown) => {
        if (!current || typeof current !== 'object') return current;
        return { ...current, status: 'queued', attempts: 0, nextRetryAt: null };
      });
      return { previous };
    },
    onError: (_error, _eventId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['events', 'detail', eventId], context.previous);
      }
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['events', 'detail', eventId] }),
        queryClient.invalidateQueries({ queryKey: ['events'] }),
      ]);
    },
  });
}
