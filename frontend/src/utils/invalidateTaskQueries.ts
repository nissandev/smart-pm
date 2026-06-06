import type { QueryClient } from '@tanstack/react-query';

/** Keep task lists, My Work, and dashboard KPIs in sync after any task change. */
export function invalidateTaskQueries(
  qc: QueryClient,
  opts?: { projectId?: string },
) {
  qc.invalidateQueries({ queryKey: ['tasks'] });
  qc.invalidateQueries({ queryKey: ['my-work'] });
  qc.invalidateQueries({ queryKey: ['dashboard'] });
  if (opts?.projectId) {
    qc.invalidateQueries({ queryKey: ['activity', 'project', opts.projectId] });
  }
}
