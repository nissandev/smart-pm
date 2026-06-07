/** Centralized React Query keys — avoids typos and eases invalidation. */
export const queryKeys = {
  users: {
    all: ['users'] as const,
  },
  groups: {
    all: ['groups'] as const,
  },
  projects: {
    all: ['projects'] as const,
    detail: (id: string) => ['project', id] as const,
    taskCounts: ['project-task-counts'] as const,
    expenseTotals: ['expense-totals'] as const,
    syncPreview: (projectId: string, teamId?: string) =>
      ['sync-preview', projectId, teamId] as const,
  },
  tasks: {
    all: ['tasks'] as const,
    list: (filters: Record<string, string>) => ['tasks', filters] as const,
    detail: (id: string) => ['task', id] as const,
  },
  expenses: {
    list: (projectId: string) => ['expenses', projectId] as const,
    summary: (projectId: string) => ['expenses-summary', projectId] as const,
  },
  activity: {
    project: (projectId: string) => ['activity', 'project', projectId] as const,
    recent: (limit: number, projectId?: string) =>
      projectId ? (['activity', 'project', projectId] as const) : (['activity', limit] as const),
  },
  dashboard: {
    summary: ['dashboard'] as const,
  },
  myWork: {
    list: (filters: Record<string, string>) => ['my-work', filters] as const,
  },
} as const;
