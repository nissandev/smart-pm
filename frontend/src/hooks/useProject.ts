import { useQuery } from '@tanstack/react-query';
import { projectsApi, activityApi, expensesApi } from '@/services';
import { queryKeys } from '@/lib/query-keys';

export function useProject(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.projects.detail(projectId!),
    queryFn: ({ signal }) => projectsApi.getById(projectId!, signal).then((r) => r.data),
    enabled: !!projectId,
  });
}

export function useProjectSyncPreview(
  projectId: string | undefined,
  teamId: string | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: queryKeys.projects.syncPreview(projectId!, teamId),
    queryFn: ({ signal }) =>
      projectsApi.getSyncFromGroupPreview(projectId!, teamId, signal).then((r) => r.data),
    enabled: !!projectId && !!teamId && enabled,
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

export function useProjectActivity(projectId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.activity.project(projectId!),
    queryFn: ({ signal }) => activityApi.getRecent(8, projectId, signal).then((r) => r.data),
    enabled: !!projectId && enabled,
  });
}

export function useProjectExpenseSummary(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.expenses.summary(projectId!),
    queryFn: ({ signal }) => expensesApi.getSummary(projectId!, signal),
    enabled: !!projectId,
  });
}
