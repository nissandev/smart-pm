import { useQuery } from '@tanstack/react-query';
import { projectsApi } from '@/services';
import { queryKeys } from '@/lib/query-keys';

export function useProjects() {
  return useQuery({
    queryKey: queryKeys.projects.all,
    queryFn: () => projectsApi.getAll(),
  });
}

export function useProjectTaskCounts() {
  return useQuery({
    queryKey: queryKeys.projects.taskCounts,
    queryFn: () => projectsApi.getTaskCounts(),
  });
}

export function useProjectExpenseTotals() {
  return useQuery({
    queryKey: queryKeys.projects.expenseTotals,
    queryFn: () => projectsApi.getExpenseTotals(),
  });
}
