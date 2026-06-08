import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from './query-keys';

export function invalidateTaskQueries(
  qc: QueryClient,
  opts?: { projectId?: string; taskId?: string },
) {
  qc.invalidateQueries({ queryKey: queryKeys.tasks.all });
  qc.invalidateQueries({ queryKey: ['my-work'] });
  qc.invalidateQueries({ queryKey: queryKeys.dashboard.summary });
  qc.invalidateQueries({ queryKey: queryKeys.projects.taskCounts });
  if (opts?.taskId) {
    qc.invalidateQueries({ queryKey: queryKeys.tasks.detail(opts.taskId) });
  }
  if (opts?.projectId) {
    qc.invalidateQueries({ queryKey: queryKeys.activity.project(opts.projectId) });
    qc.invalidateQueries({ queryKey: queryKeys.projects.syncPreview(opts.projectId) });
  }
}

export function invalidateProjectQueries(qc: QueryClient, projectId: string) {
  qc.invalidateQueries({ queryKey: queryKeys.projects.detail(projectId) });
  qc.invalidateQueries({ queryKey: queryKeys.projects.all });
  qc.invalidateQueries({ queryKey: queryKeys.projects.syncPreview(projectId) });
  qc.invalidateQueries({ queryKey: queryKeys.activity.project(projectId) });
  qc.invalidateQueries({ queryKey: queryKeys.tasks.all });
  qc.invalidateQueries({ queryKey: queryKeys.dashboard.summary });
}
