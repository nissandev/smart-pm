import api from './api';
import type {
  Project, Task, User, TeamGroup, DashboardStats, MyWorkStats, GroupSyncPreview, Paginated, Activity,
  NotificationListResponse, ProjectExpense, ExpenseSummary, ExpenseCategory,
} from '../types';

/** Backend list endpoints always return paginated payloads — unwrap for UI dropdowns/lists. */
const LIST_LIMIT = 200;

function isPaginated<T>(body: unknown): body is Paginated<T> {
  return !!body && typeof body === 'object' && 'data' in body && Array.isArray((body as Paginated<T>).data);
}

function unwrapList<T>(response: { data: T[] | Paginated<T> }): T[] {
  return isPaginated(response.data) ? response.data.data : (response.data as T[]);
}

export async function downloadTaskAttachment(taskId: string, idx: number, filename: string) {
  const res = await api.get(`/tasks/${taskId}/attachments/${idx}/download`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.click();
  URL.revokeObjectURL(url);
}

// ── Auth ──────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ user: User; token: string }>('/auth/login', { email, password }),
  register: (data: { name: string; email: string; password: string; role?: string }) =>
    api.post<{ user: User; token: string }>('/auth/register', data),
  me: () => api.get<User>('/auth/me'),
};

// ── Users ─────────────────────────────────────────────────────
export const usersApi = {
  getAll: () => api.get<User[]>('/users', { params: { limit: LIST_LIMIT } }).then(unwrapList),
  create: (data: { name: string; email: string; password: string; role?: string }) =>
    api.post<User>('/users', data),
  getById: (id: string) => api.get<User>(`/users/${id}`),
  update: (id: string, data: Partial<User>) => api.patch<User>(`/users/${id}`, data),
  updateRole: (id: string, role: string) => api.patch<User>(`/users/${id}/role`, { role }),
  delete: (id: string) => api.delete(`/users/${id}`),
};

// ── Projects ──────────────────────────────────────────────────
export interface CreateProjectInput {
  name: string;
  description?: string;
  deadline: string;
  status?: Project['status'];
  /** Admin only — assign a PM as project lead at creation time. */
  leadId?: string;
  /** @deprecated use leadId */
  ownerId?: string;
  /** Copy group members into the project at creation (snapshot). */
  teamId?: string;
}

// ── Groups ────────────────────────────────────────────────────
export interface CreateGroupInput {
  name: string;
  leadId: string;
  memberIds: string[];
}

export const groupsApi = {
  getAll: () => api.get<TeamGroup[]>('/groups'),
  getById: (id: string) => api.get<TeamGroup>(`/groups/${id}`),
  create: (data: CreateGroupInput) => api.post<TeamGroup>('/groups', data),
  update: (id: string, data: Partial<CreateGroupInput>) => api.patch<TeamGroup>(`/groups/${id}`, data),
  delete: (id: string) => api.delete(`/groups/${id}`),
};

export const projectsApi = {
  getAll: () => api.get<Project[]>('/projects', { params: { limit: LIST_LIMIT } }).then(unwrapList),
  getById: (id: string) => api.get<Project>(`/projects/${id}`),
  getStats: () => api.get('/projects/stats'),
  getTaskCounts: () =>
    api
      .get<Record<string, { total: number; completed: number }>>('/projects/task-counts')
      .then((r) => r.data),
  create: (data: CreateProjectInput) => api.post<Project>('/projects', data),
  update: (id: string, data: Partial<Project>) => api.patch<Project>(`/projects/${id}`, data),
  delete: (id: string) => api.delete(`/projects/${id}`),
  addMember: (projectId: string, memberId: string, options?: { makeLead?: boolean; makeOwner?: boolean }) =>
    api.post<Project>(`/projects/${projectId}/members/${memberId}`, {
      makeLead: options?.makeLead ?? options?.makeOwner ?? false,
    }),
  addMembersFromGroup: (projectId: string, teamId: string, options?: { makeLead?: boolean; makeOwner?: boolean }) =>
    api.post<Project>(`/projects/${projectId}/members/from-group`, {
      teamId,
      makeLead: options?.makeLead ?? options?.makeOwner ?? false,
    }),
  getSyncFromGroupPreview: (projectId: string, teamId?: string) =>
    api.get<GroupSyncPreview>(`/projects/${projectId}/sync-from-group/preview`, {
      params: teamId ? { teamId } : {},
    }),
  syncFromGroup: (
    projectId: string,
    data: { teamId?: string; removeAbsent?: boolean; updateLead?: boolean },
  ) => api.post<Project>(`/projects/${projectId}/sync-from-group`, data),
  removeMember: (projectId: string, memberId: string) =>
    api.delete<Project>(`/projects/${projectId}/members/${memberId}`),
  getExpenseTotals: () =>
    api.get<Record<string, number>>('/expenses/totals-by-project').then((r) => r.data),
};

export interface ExpenseInput {
  category: ExpenseCategory;
  description: string;
  amount: number;
  currency?: string;
  date: string;
  notes?: string;
}

export const expensesApi = {
  getAll: (projectId: string) =>
    api.get<ProjectExpense[]>(`/projects/${projectId}/expenses`).then((r) => r.data),
  getSummary: (projectId: string) =>
    api.get<ExpenseSummary>(`/projects/${projectId}/expenses/summary`).then((r) => r.data),
  create: (projectId: string, data: ExpenseInput) =>
    api.post<ProjectExpense>(`/projects/${projectId}/expenses`, data).then((r) => r.data),
  update: (projectId: string, expenseId: string, data: Partial<ExpenseInput>) =>
    api.patch<ProjectExpense>(`/projects/${projectId}/expenses/${expenseId}`, data).then((r) => r.data),
  delete: (projectId: string, expenseId: string) =>
    api.delete(`/projects/${projectId}/expenses/${expenseId}`),
};

// ── Tasks ─────────────────────────────────────────────────────
// Input shape sent to the API. Differs from `Task` because `assignedTo`
// and `project` are sent as plain string IDs, while the populated
// response shape uses `User` / `Project` objects.
export interface TaskInput {
  title?: string;
  description?: string;
  project?: string;
  assignedTo?: string;
  dueDate?: string;
  priority?: Task['priority'];
  status?: Task['status'];
}

export const tasksApi = {
  getAll: (filters?: Record<string, string>) =>
    api.get<Task[]>('/tasks', { params: { limit: LIST_LIMIT, ...filters } }).then(unwrapList),
  getById: (id: string) => api.get<Task>(`/tasks/${id}`),
  getStats: () => api.get('/tasks/stats'),
  create: (data: TaskInput & { project: string }) => api.post<Task>('/tasks', data),
  update: (id: string, data: TaskInput) => api.patch<Task>(`/tasks/${id}`, data),
  delete: (id: string) => api.delete(`/tasks/${id}`),
  addComment: (id: string, text: string) => api.post<Task>(`/tasks/${id}/comments`, { text }),
  updateComment: (id: string, commentId: string, text: string) =>
    api.patch<Task>(`/tasks/${id}/comments/${commentId}`, { text }),
  deleteComment: (id: string, commentId: string) =>
    api.delete<Task>(`/tasks/${id}/comments/${commentId}`),
  uploadAttachment: (id: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post<Task>(`/tasks/${id}/attachments`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  deleteAttachment: (id: string, idx: number) =>
    api.delete<Task>(`/tasks/${id}/attachments/${idx}`),
  downloadImportTemplate: () =>
    api.get<Blob>('/tasks/import/template', { responseType: 'blob' }).then((r) => r.data),
  bulkImport: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post<{
      created: number;
      failed: number;
      results: { row: number; title: string; success: boolean; error?: string }[];
    }>('/tasks/import/bulk', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// ── Activity ──────────────────────────────────────────────────
export const activityApi = {
  getRecent: (limit = 10, project?: string) =>
    api.get<Activity[]>('/activity/recent', { params: { limit, project } }),
  getAll: (page = 1, limit = 20, project?: string) =>
    api.get<Paginated<Activity>>('/activity', { params: { page, limit, project } }),
};

// ── Dashboard ─────────────────────────────────────────────────
export const dashboardApi = {
  getSummary: () => api.get<DashboardStats>('/dashboard'),
  getMyWork: (filters?: { project?: string; assignee?: string }) =>
    api.get<MyWorkStats>('/dashboard/my-work', { params: filters }),
};

// ── Notifications ─────────────────────────────────────────────
export const notificationsApi = {
  list: (limit = 20) =>
    api.get<NotificationListResponse>('/notifications', { params: { limit } }),
  unreadCount: () => api.get<{ count: number }>('/notifications/unread-count'),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
  clearAll: () => api.delete('/notifications'),
};
