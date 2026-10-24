import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiKey } from '@hookrelay/shared';
import { apiKeysApi } from '../lib/api.js';

const API_KEYS_QUERY_KEY = ['api-keys'] as const;

export function useApiKeys() {
  return useQuery({
    queryKey: API_KEYS_QUERY_KEY,
    queryFn: apiKeysApi.list,
    staleTime: 30_000,
  });
}

export function useCreateApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: apiKeysApi.create,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: API_KEYS_QUERY_KEY });
    },
  });
}

export function useRevokeApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: apiKeysApi.revoke,
    onMutate: async (keyId) => {
      await queryClient.cancelQueries({ queryKey: API_KEYS_QUERY_KEY });
      const previous = queryClient.getQueryData<ApiKey[]>(API_KEYS_QUERY_KEY);
      queryClient.setQueryData<ApiKey[]>(API_KEYS_QUERY_KEY, (keys) =>
        keys?.map((key) => (key.id === keyId ? { ...key, isActive: false } : key)),
      );
      return { previous };
    },
    onError: (_error, _keyId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(API_KEYS_QUERY_KEY, context.previous);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: API_KEYS_QUERY_KEY });
    },
  });
}
