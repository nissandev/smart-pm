// ── User ──────────────────────────────────────────────────────
export type UserRole = 'admin' | 'project_manager' | 'member';

export interface User {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Team Group ────────────────────────────────────────────────
export interface TeamGroup {
  _id: string;
  name: string;
  leadId: User | string;
  memberIds: User[];
  createdBy: User | string;
  createdAt: string;
  updatedAt: string;
}

// ── Project ───────────────────────────────────────────────────
export type ProjectStatus = 'Active' | 'Completed' | 'On Hold';

export interface Project {
  _id: string;
  name: string;
  description?: string;
  deadline: string;
  status: ProjectStatus;
  /** Admin who owns the project record. */
  createdBy: User | string;
  /** PM who leads the project (full manage access). */
  leadId?: User | string;
  members: User[];
  teamId?: TeamGroup | string;
  createdAt: string;
  updatedAt: string;
}

// ── Task ──────────────────────────────────────────────────────
export type TaskPriority = 'High' | 'Medium' | 'Low';
export type TaskStatus = 'Todo' | 'In Progress' | 'Completed';

export interface TaskComment {
  _id: string;
  author: User;
  text: string;
  createdAt: string;
}

export interface TaskAttachment {
  url: string;
  name: string;
  size?: number;
  mimeType?: string;
  uploadedBy?: User | string;
  uploadedAt?: string;
}

export interface Task {
  _id: string;
  project: Project | string;
  title: string;
  description?: string;
  assignedTo?: User;
  dueDate: string;
  priority: TaskPriority;
  status: TaskStatus;
  createdBy: User | string;
  attachments: TaskAttachment[];
  comments: TaskComment[];
  createdAt: string;
  updatedAt: string;
}

// ── Activity ──────────────────────────────────────────────────
export interface Activity {
  _id: string;
  actor: User;
  actionType: string;
  entityType: string;
  description: string;
  project?: string;
  createdAt: string;
}

// ── Notifications ─────────────────────────────────────────────
export type NotificationType =
  | 'task_assigned'
  | 'task_status_changed'
  | 'task_due_soon'
  | 'comment_added'
  | 'member_added';

export interface Notification {
  _id: string;
  type: NotificationType;
  title: string;
  message?: string;
  read: boolean;
  actor?: User;
  task?: { _id: string; title: string };
  project?: { _id: string; name: string };
  createdAt: string;
}

export interface NotificationListResponse {
  items: Notification[];
  unread: number;
}

// ── Auth ──────────────────────────────────────────────────────
export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

// ── API pagination ────────────────────────────────────────────
export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

// ── Dashboard stats ───────────────────────────────────────────
export interface MemberWorkload {
  name: string;
  total: number;
  completed: number;
  inProgress: number;
  todo: number;
}

export interface ProjectSummary {
  _id: string;
  name: string;
  status: ProjectStatus;
  deadline: string;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  completionPct: number;
  deadlineColor: 'red' | 'yellow' | 'green';
}

export interface MyWorkStats {
  counts: { overdue: number; dueSoon: number; stagnant: number };
  overdue: Task[];
  dueSoon: Task[];
  stagnant: Task[];
  filters: {
    projects: { _id: string; name: string }[];
    assignees: { _id: string; name: string }[];
  };
}

export interface DashboardStats {
  projects: { total: number; active: number; completed: number; onHold: number };
  tasks: { total: number; todo: number; inProgress: number; completed: number; overdue: number; pending: number };
  tasksByPriority: { priority: string; count: number }[];
  taskStatusDistribution: { status: string; count: number }[];
  completionTrend: { label: string; completed: number; created: number }[];
  projectSummary: ProjectSummary[];
  upcomingDeadlines: Task[];
  highPriorityTasks: Task[];
  memberWorkload: MemberWorkload[];
  teamProductivity: { name: string; completed: number }[];
  recentActivity: Activity[];
}
