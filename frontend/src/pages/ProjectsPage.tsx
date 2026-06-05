import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Trash2, Edit2, ChevronRight, Calendar, Search,
  ChevronLeft, ChevronRight as ChevronRightIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format, isPast, differenceInDays, addDays, startOfDay } from 'date-fns';
import { projectsApi, usersApi } from '../services';
import { useAuthStore } from '../store/authStore';
import {
  LoadingScreen, PageHeader, EmptyState, ProjectStatusBadge, ConfirmModal,
} from '../components/shared';
import type { Project, User } from '../types';

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

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, deadlineFilter, createdByFilter]);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.getAll().then((r) => r.data),
  });

  // PRD §09: "Created by (Admin view)" project filter — admin-only.
  const isAdmin = user?.role === 'admin';
  const { data: allUsers = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.getAll().then((r) => r.data),
    enabled: isAdmin,
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

  const filtered = useMemo(() => {
    const today = startOfDay(new Date());
    const in7days = addDays(today, 7);
    return projects.filter((p) => {
      const matchesSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = !statusFilter || p.status === statusFilter;
      let matchesDeadline = true;
      if (deadlineFilter === 'overdue') {
        matchesDeadline = p.status !== 'Completed' && isPast(new Date(p.deadline));
      } else if (deadlineFilter === 'upcoming') {
        const due = startOfDay(new Date(p.deadline));
        matchesDeadline = p.status !== 'Completed' && due >= today && due <= in7days;
      }
      let matchesCreator = true;
      if (createdByFilter && isAdmin) {
        const creatorId = typeof p.createdBy === 'object' ? (p.createdBy as User)._id : p.createdBy;
        matchesCreator = creatorId === createdByFilter;
      }
      return matchesSearch && matchesStatus && matchesDeadline && matchesCreator;
    });
  }, [projects, search, statusFilter, deadlineFilter, createdByFilter, isAdmin]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const from = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const to = Math.min(safePage * PAGE_SIZE, filtered.length);

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
        subtitle={
          filtered.length === projects.length
            ? `${projects.length} project${projects.length !== 1 ? 's' : ''}`
            : `${filtered.length} of ${projects.length} project${projects.length !== 1 ? 's' : ''}`
        }
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
        <EmptyState
          title="No projects yet"
          description="Create your first project to get started"
          action={canCreate ? <button className="btn-primary" onClick={() => setShowForm(true)}>Create Project</button> : undefined}
        />
      ) : filtered.length === 0 ? (
        <EmptyState title="No matches" description="Try adjusting your search or filter" />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginated.map((project) => (
            <div key={project._id} className="card p-5 hover:shadow-md transition-shadow cursor-pointer group" onClick={() => navigate(`/projects/${project._id}`)}>
              <div className="flex items-start justify-between mb-3">
                <ProjectStatusBadge status={project.status} />
                {canCreate && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                    <button className="p-1.5 text-slate-400 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg transition-colors" onClick={() => setEditing(project)}>
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" onClick={() => setDeleting(project)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white mb-1.5 leading-tight">{project.name}</h3>
              {project.description && <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-3">{project.description}</p>}
              <div className={`flex items-center gap-1.5 text-xs font-medium ${deadlineColor(project.deadline)}`}>
                <Calendar className="w-3.5 h-3.5" />
                {format(new Date(project.deadline), 'MMM d, yyyy')}
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/50">
                <div className="flex -space-x-1.5">
                  {project.members?.slice(0, 4).map((m: any) => (
                    <div key={m._id || m} className="w-6 h-6 rounded-full bg-brand-600 border-2 border-white dark:border-[#16162b] flex items-center justify-center text-white text-[10px] font-semibold">
                      {m.name?.[0]?.toUpperCase() || '?'}
                    </div>
                  ))}
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {filtered.length > PAGE_SIZE && (
        <div className="mt-5 flex items-center justify-between flex-wrap gap-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Showing {from}–{to} of {filtered.length}
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
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSubmit={(data) => {
            if (editing) updateMutation.mutate({ id: editing._id, data });
            else createMutation.mutate(data as any);
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

function ProjectFormModal({ project, onClose, onSubmit, loading }: {
  project: Project | null;
  onClose: () => void;
  onSubmit: (data: any) => void;
  loading: boolean;
}) {
  const [name, setName] = useState(project?.name || '');
  const [description, setDescription] = useState(project?.description || '');
  const [deadline, setDeadline] = useState(project?.deadline?.slice(0, 10) || '');
  const [status, setStatus] = useState(project?.status || 'Active');

  const handle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !deadline) { toast.error('Name and deadline are required'); return; }
    onSubmit({ name, description, deadline, status });
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
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Saving…' : project ? 'Save changes' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
