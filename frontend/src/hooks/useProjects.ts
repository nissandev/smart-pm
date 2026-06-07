import { useQuery } from '@tanstack/react-query';
import { projectsApi } from '@/services';
import { queryKeys } from '@/lib/query-keys';

export function useProjects() {
  return useQuery({
    queryKey: queryKeys.projects.all,
    queryFn: ({ signal }) => projectsApi.getAll(undefined, signal),
  });
}

export function useProjectTaskCounts() {
  return useQuery({
    queryKey: queryKeys.projects.taskCounts,
    queryFn: ({ signal }) => projectsApi.getTaskCounts(signal),
  });
}

export function useProjectExpenseTotals() {
  return useQuery({
    queryKey: queryKeys.projects.expenseTotals,
    queryFn: ({ signal }) => projectsApi.getExpenseTotals(signal),
  });
}
