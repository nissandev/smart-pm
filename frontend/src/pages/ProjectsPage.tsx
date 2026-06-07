import { useState, useMemo, useEffect, useDeferredValue } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Trash2, Edit2, ChevronRight, Calendar, Search,
  ChevronLeft, ChevronRight as ChevronRightIcon, Users, DollarSign,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format, isPast, differenceInDays } from 'date-fns';
import { projectsApi, usersApi, groupsApi, type CreateProjectInput } from '../services';
import { useAuthStore } from '../store/authStore';
import {
  LoadingScreen, PageHeader, EmptyState, ProjectStatusBadge, ConfirmModal,
  ProjectProgressRing,
} from '../components/shared';
import { CopyProjectIdButton } from '../components/projects/CopyProjectIdButton';
import { formatCurrency, formatTeamLabel } from '../utils/projectTeam';
import type { Project, User, TeamGroup } from '../types';

const PAGE_SIZE = 12;

export default function ProjectsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const canCreate = user?.role !== 'member';

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState<Project | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deadlineFilter, setDeadlineFilter] = useState('');
  const [createdByFilter, setCreatedByFilter] = useState('');
  const [page, setPage] = useState(1);

  // PRD §09: "Created by (Admin view)" project filter — admin-only.
  const isAdmin = user?.role === 'admin';
  const canPickGroup = user?.role === 'admin' || user?.role === 'project_manager';

  const deferredSearch = useDeferredValue(search);

  const serverFilters = useMemo(() => {
    const f: Record<string, string> = {};
    if (deferredSearch.trim()) f.search = deferredSearch.trim();
    if (statusFilter) f.status = statusFilter;
    if (deadlineFilter) f.deadline = deadlineFilter;
    if (createdByFilter && isAdmin) f.createdBy = createdByFilter;
    return f;
  }, [deferredSearch, statusFilter, deadlineFilter, createdByFilter, isAdmin]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [serverFilters]);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects', serverFilters],
    queryFn: ({ signal }) => projectsApi.getAll(serverFilters, signal),
    placeholderData: keepPreviousData,
  });

  const { data: taskStatsByProject = {} } = useQuery({
    queryKey: ['project-task-counts'],
    queryFn: ({ signal }) => projectsApi.getTaskCounts(signal),
  });

  const { data: expenseTotals = {} } = useQuery({
    queryKey: ['expense-totals'],
    queryFn: ({ signal }) => projectsApi.getExpenseTotals(signal),
  });
  const { data: allUsers = [] } = useQuery({
    queryKey: ['users'],
    queryFn: ({ signal }) => usersApi.getAll(undefined, signal),
    enabled: isAdmin,
  });

  const { data: groups = [] } = useQuery({
    queryKey: ['groups'],
    queryFn: ({ signal }) => groupsApi.getAll(signal).then((r) => r.data),
    enabled: canPickGroup,
  });

  const createMutation = useMutation({
    mutationFn: projectsApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); setShowForm(false); toast.success('Project created'); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to create project'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Project> }) => projectsApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); setEditing(null); toast.success('Project updated'); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to update project'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => projectsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); setDeleting(null); toast.success('Project deleted'); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to delete project'),
  });

  const totalPages = Math.max(1, Math.ceil(projects.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = projects.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const from = projects.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const to = Math.min(safePage * PAGE_SIZE, projects.length);

  const deadlineColor = (d: string) => {
    const days = differenceInDays(new Date(d), new Date());
    if (isPast(new Date(d))) return 'text-red-500';
    if (days <= 2) return 'text-red-400';
    if (days <= 7) return 'text-amber-400';
    return 'text-emerald-400';
  };

  if (isLoading) return <LoadingScreen />;

  return (
    <div>
      <PageHeader
        title="Projects"
        subtitle={`${projects.length} project${projects.length !== 1 ? 's' : ''}`}
        action={
          canCreate ? (
            <button className="btn-primary flex items-center gap-2" onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4" /> New Project
            </button>
          ) : undefined
        }
      />

      {/* Search + Filter bar */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="input pl-9 w-full"
            placeholder="Search projects…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input w-44"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="Active">Active</option>
          <option value="Completed">Completed</option>
          <option value="On Hold">On Hold</option>
        </select>
        <select
          className="input w-44"
          value={deadlineFilter}
          onChange={(e) => setDeadlineFilter(e.target.value)}
          title="Filter by deadline"
        >
          <option value="">All deadlines</option>
          <option value="upcoming">Upcoming (7d)</option>
          <option value="overdue">Overdue</option>
        </select>
        {/* PRD §09: "Created by" project filter (admin view) */}
        {isAdmin && (
          <select
            className="input w-44"
            value={createdByFilter}
            onChange={(e) => setCreatedByFilter(e.target.value)}
            title="Filter by creator"
          >
            <option value="">All creators</option>
            {(allUsers as User[]).map((u) => (
              <option key={u._id} value={u._id}>
                {u.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {projects.length === 0 ? (
        Object.keys(serverFilters).length > 0
          ? <EmptyState title="No matches" description="Try adjusting your search or filter" />
          : <EmptyState
              title="No projects yet"
              description="Create your first project to get started"
              action={canCreate ? <button className="btn-primary" onClick={() => setShowForm(true)}>Create Project</button> : undefined}
            />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginated.map((project) => {
            const stats = taskStatsByProject[project._id] ?? { total: 0, completed: 0 };
            const allTasksDone = stats.total > 0 && stats.completed === stats.total;

            return (
            <div
              key={project._id}
              className={`card p-5 hover:shadow-md transition-all cursor-pointer group ${
                allTasksDone
                  ? 'ring-2 ring-emerald-400/70 bg-emerald-50/60 dark:bg-emerald-950/25 border-emerald-200 dark:border-emerald-800/50'
                  : ''
              }`}
              onClick={() => navigate(`/projects/${project._id}`)}
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                  <ProjectStatusBadge status={project.status} />
                  {allTasksDone && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500 text-white">
                      All tasks done
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <ProjectProgressRing completed={stats.completed} total={stats.total} />
                  {canCreate && (
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                      <CopyProjectIdButton projectId={project._id} />
                      <button className="p-1.5 text-slate-400 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg transition-colors" onClick={() => setEditing(project)}>
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" onClick={() => setDeleting(project)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <h3 className={`font-semibold mb-1.5 leading-tight ${
                allTasksDone
                  ? 'text-emerald-800 dark:text-emerald-200'
                  : 'text-slate-900 dark:text-white'
              }`}>
                {project.name}
              </h3>
              {project.description && <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-3">{project.description}</p>}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400 mb-3">
                <span className="inline-flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {formatTeamLabel(project)}
                </span>
                {(expenseTotals[project._id] ?? 0) > 0 && (
                  <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                    <DollarSign className="w-3 h-3" />
                    {formatCurrency(expenseTotals[project._id])} spent
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className={`flex items-center gap-1.5 text-xs font-medium ${deadlineColor(project.deadline)}`}>
                  <Calendar className="w-3.5 h-3.5" />
                  {format(new Date(project.deadline), 'MMM d, yyyy')}
                </div>
                {stats.total > 0 && (
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">
                    {stats.completed}/{stats.total} tasks
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/50">
                <div className="flex -space-x-1.5">
                  {project.members?.slice(0, 4).map((m: any) => (
                    <div key={m._id || m} className="w-6 h-6 rounded-full bg-brand-600 border-2 border-white dark:border-[#16162b] flex items-center justify-center text-white text-[10px] font-semibold">
                      {m.name?.[0]?.toUpperCase() || '?'}
                    </div>
                  ))}
                </div>
                <ChevronRight className={`w-4 h-4 ${allTasksDone ? 'text-emerald-500' : 'text-slate-400'}`} />
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {projects.length > PAGE_SIZE && (
        <div className="mt-5 flex items-center justify-between flex-wrap gap-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Showing {from}–{to} of {projects.length}
          </p>
          <div className="flex items-center gap-2">
            <button
              className="btn-secondary py-1.5 px-3 flex items-center gap-1 text-xs disabled:opacity-50"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Prev
            </button>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Page {safePage} of {totalPages}
            </span>
            <button
              className="btn-secondary py-1.5 px-3 flex items-center gap-1 text-xs disabled:opacity-50"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
            >
              Next <ChevronRightIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Create / Edit form modal */}
      {(showForm || editing) && (
        <ProjectFormModal
          project={editing}
          isAdmin={user?.role === 'admin'}
          groups={groups}
          canPickGroup={canPickGroup}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSubmit={(data) => {
            if (editing) updateMutation.mutate({ id: editing._id, data: data as Partial<Project> });
            else createMutation.mutate(data as CreateProjectInput);
          }}
          loading={createMutation.isPending || updateMutation.isPending}
        />
      )}

      {/* Delete confirm */}
      {deleting && (
        <ConfirmModal
          title="Delete Project"
          description={`Are you sure you want to delete "${deleting.name}"? All tasks under this project will also be permanently deleted.`}
          onConfirm={() => deleteMutation.mutate(deleting._id)}
          onCancel={() => setDeleting(null)}
          loading={deleteMutation.isPending}
        />
      )}
    </div>
  );
}

function ProjectFormModal({ project, isAdmin, groups, canPickGroup, onClose, onSubmit, loading }: {
  project: Project | null;
  isAdmin: boolean;
  groups: TeamGroup[];
  canPickGroup: boolean;
  onClose: () => void;
  onSubmit: (data: CreateProjectInput | Partial<Project>) => void;
  loading: boolean;
}) {
  const [name, setName] = useState(project?.name || '');
  const [description, setDescription] = useState(project?.description || '');
  const [deadline, setDeadline] = useState(project?.deadline?.slice(0, 10) || '');
  const [status, setStatus] = useState(project?.status || 'Active');
  const [leadId, setLeadId] = useState('');
  const [teamId, setTeamId] = useState('');

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users'],
    queryFn: ({ signal }) => usersApi.getAll(undefined, signal),
    enabled: isAdmin && !project,
  });
  const projectManagers = allUsers.filter((u) => u.role === 'project_manager');

  const handle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !deadline) { toast.error('Name and deadline are required'); return; }
    if (project) {
      onSubmit({ name, description, deadline, status });
    } else {
      onSubmit({
        name,
        description,
        deadline,
        status,
        ...(leadId ? { leadId } : {}),
        ...(teamId ? { teamId } : {}),
      });
    }
  };

  const handleTeamChange = (id: string) => {
    setTeamId(id);
    if (!id) return;
    const group = groups.find((g) => g._id === id);
    const leadId = group && typeof group.leadId === 'object' ? group.leadId._id : group?.leadId;
    if (leadId && isAdmin) setLeadId(String(leadId));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="card max-w-lg w-full p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          {project ? 'Edit Project' : 'New Project'}
        </h2>
        <form onSubmit={handle} className="space-y-4">
          <div>
            <label className="label">Name *</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder="Project name" />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Deadline *</label>
              <input type="date" className="input" value={deadline} onChange={(e) => setDeadline(e.target.value)} min={new Date().toISOString().slice(0, 10)} />
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={status} onChange={(e) => setStatus(e.target.value as any)}>
                <option>Active</option>
                <option>Completed</option>
                <option>On Hold</option>
              </select>
            </div>
          </div>
          {canPickGroup && !project && groups.length > 0 && (
            <div>
              <label className="label">Assign team group</label>
              <select className="input" value={teamId} onChange={(e) => handleTeamChange(e.target.value)}>
                <option value="">No group — add members manually later</option>
                {groups.map((g) => (
                  <option key={g._id} value={g._id}>
                    {g.name} ({g.memberIds.length + 1} people)
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-400 mt-1">
                Copies all group members into this project. Group PM becomes project lead unless you override below.
              </p>
            </div>
          )}
          {isAdmin && !project && (
            <div>
              <label className="label">Project lead (PM)</label>
              <select
                className="input"
                value={leadId}
                onChange={(e) => setLeadId(e.target.value)}
              >
                <option value="">No PM lead yet</option>
                {projectManagers.map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.name} — Project Manager
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-400 mt-1">
                Optional. You remain the project owner. The PM gets full manage access.
              </p>
            </div>
          )}
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Saving…' : project ? 'Save changes' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
