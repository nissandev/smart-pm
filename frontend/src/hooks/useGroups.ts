import { useQuery } from '@tanstack/react-query';
import { groupsApi } from '@/services';
import { queryKeys } from '@/lib/query-keys';

export function useGroups(enabled = true) {
  return useQuery({
    queryKey: queryKeys.groups.all,
    queryFn: ({ signal }) => groupsApi.getAll(signal),
    enabled,
  });
}
