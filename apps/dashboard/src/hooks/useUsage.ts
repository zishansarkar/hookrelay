import { useQuery } from '@tanstack/react-query';
import { usageApi } from '../lib/api.js';

export function useUsage() {
  return useQuery({
    queryKey: ['usage', 'current'],
    queryFn: usageApi.getCurrent,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useDailyUsage() {
  return useQuery({
    queryKey: ['usage', 'daily'],
    queryFn: usageApi.getDailyStats,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}
