import { useQuery } from '@tanstack/react-query';
import { usersApi } from '@/services';
import { queryKeys } from '@/lib/query-keys';

export function useUsers(enabled = true) {
  return useQuery({
    queryKey: queryKeys.users.all,
    queryFn: () => usersApi.getAll(),
    enabled,
  });
}
