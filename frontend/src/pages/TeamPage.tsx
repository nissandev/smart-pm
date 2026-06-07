import { useState, useMemo, useDeferredValue } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Search, Mail, LayoutGrid, BarChart2, Filter, Plus, Edit2, Trash2, UsersRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { usersApi, tasksApi, dashboardApi, projectsApi, groupsApi, type CreateGroupInput } from '../services';
import { useAuthStore } from '../store/authStore';
import {
  LoadingScreen, PageHeader, EmptyState, Avatar, PriorityBadge, TaskStatusBadge,
  ConfirmModal, Spinner,
} from '../components/shared';
import type { User, UserRole, Task, TaskPriority, TaskStatus, Project, TeamGroup } from '../types';

const ROLE_STYLES: Record<UserRole, string> = {
  admin: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  project_manager: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  member: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
};

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  project_manager: 'Project Manager',
  member: 'Member',
};

export default function TeamPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user: me } = useAuthStore();
  const isAdminOrPM = me?.role === 'admin' || me?.role === 'project_manager';
  const isAdmin = me?.role === 'admin';

  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [tab, setTab] = useState<'members' | 'groups' | 'workload'>('members');
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [editingGroup, setEditingGroup] = useState<TeamGroup | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<TeamGroup | null>(null);
  const [groupSearch, setGroupSearch] = useState('');

  // Workload tab filters
  const [wlProject, setWlProject] = useState('');
  const [wlStatus, setWlStatus] = useState('');
  const [wlPriority, setWlPriority] = useState('');

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['users', deferredSearch],
    queryFn: ({ signal }) =>
      usersApi.getAll(deferredSearch.trim() ? { search: deferredSearch.trim() } : undefined, signal),
    enabled: isAdmin,
    placeholderData: keepPreviousData,
  });

  const isPM = me?.role === 'project_manager';

  const { data: groups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ['groups'],
    queryFn: ({ signal }) => groupsApi.getAll(signal).then((r) => r.data),
    enabled: (isAdmin && tab === 'groups') || (isPM && tab === 'members'),
  });

  const createGroupMutation = useMutation({
    mutationFn: (data: CreateGroupInput) => groupsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups'] });
      qc.invalidateQueries({ queryKey: ['sync-preview'] });
      setShowCreateGroup(false);
      toast.success('Group created');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to create group'),
  });

  const updateGroupMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateGroupInput> }) =>
      groupsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups'] });
      qc.invalidateQueries({ queryKey: ['sync-preview'] });
      setEditingGroup(null);
      toast.success('Group updated');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to update group'),
  });

  const deleteGroupMutation = useMutation({
    mutationFn: (id: string) => groupsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups'] });
      qc.invalidateQueries({ queryKey: ['sync-preview'] });
      setDeletingGroup(null);
      toast.success('Group deleted');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to delete group'),
  });

  const wlFilters = useMemo(() => {
    const f: Record<string, string> = {};
    if (wlProject) f.project = wlProject;
    if (wlStatus) f.status = wlStatus;
    if (wlPriority) f.priority = wlPriority;
    return f;
  }, [wlProject, wlStatus, wlPriority]);

  const { data: allTasks = [], isLoading: tasksLoading, isFetching: tasksFetching } = useQuery({
    queryKey: ['tasks', 'workload', wlFilters],
    queryFn: ({ signal }) => tasksApi.getAll(wlFilters, signal),
    enabled: isAdminOrPM,
    placeholderData: keepPreviousData,
  });

  const { data: dashSummary } = useQuery({
    queryKey: ['dashboard'],
    queryFn: ({ signal }) => dashboardApi.getSummary(signal).then((r) => r.data),
    enabled: isAdminOrPM,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: ({ signal }) => projectsApi.getAll(undefined, signal),
    enabled: isAdminOrPM,
  });

  /** PM team = members admin assigned in groups this PM leads. */
  const pmTeamMembers = useMemo(() => {
    if (!isPM) return [];
    const byId = new Map<string, User>();
    for (const g of groups) {
      for (const m of g.memberIds) {
        byId.set(m._id, m);
      }
    }
    const term = search.toLowerCase();
    return Array.from(byId.values()).filter(
      (u) => !term || u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term),
    );
  }, [groups, isPM, search]);

  // Group API-filtered tasks by assigned member
  const tasksByMember = useMemo(() => {
    const map = new Map<string, { user: User | null; tasks: Task[] }>();
    for (const task of allTasks as Task[]) {
      const assignee = task.assignedTo as User | undefined;
      if (!assignee) continue;
      const key = assignee._id;
      if (!map.has(key)) map.set(key, { user: assignee, tasks: [] });
      map.get(key)!.tasks.push(task);
    }
    return Array.from(map.values()).sort((a, b) => b.tasks.length - a.tasks.length);
  }, [allTasks]);

  const filteredGroups = groups.filter((g) =>
    g.name.toLowerCase().includes(groupSearch.toLowerCase()),
  );

  const isLoading =
    (tab === 'members' && (isAdmin ? usersLoading : groupsLoading)) ||
    (tab === 'workload' && tasksLoading) ||
    (tab === 'groups' && groupsLoading);
  if (isLoading) return <LoadingScreen />;

  if (!isAdminOrPM) {
    return (
      <div>
        <PageHeader title="Team" subtitle="Your team members" />
        <div className="card p-12 flex flex-col items-center text-center">
          <Avatar name={me?.name || '?'} size="lg" />
          <p className="mt-4 text-sm font-medium text-slate-900 dark:text-white">{me?.name}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{me?.email}</p>
          <span className={`mt-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_STYLES[me!.role]}`}>
            {ROLE_LABELS[me!.role]}
          </span>
          <p className="text-xs text-slate-400 mt-6">Full team directory is visible to admins.</p>
          <button className="btn-secondary mt-3 text-xs" onClick={() => navigate('/projects')}>
            View Projects
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Team"
        subtitle={
          isAdmin
            ? `${users.length} member${users.length !== 1 ? 's' : ''}`
            : isPM
              ? `${pmTeamMembers.length} team member${pmTeamMembers.length !== 1 ? 's' : ''}`
              : 'Team workload'
        }
        action={
          isAdmin ? (
            <div className="flex gap-2">
              {tab === 'groups' && (
                <button className="btn-primary text-sm flex items-center gap-1.5" onClick={() => setShowCreateGroup(true)}>
                  <Plus className="w-4 h-4" /> New Group
                </button>
              )}
              <button className="btn-secondary text-sm" onClick={() => navigate('/users')}>
                Manage Users
              </button>
            </div>
          ) : undefined
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-slate-200 dark:border-slate-700">
        <button
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'members'
              ? 'border-brand-500 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
          onClick={() => setTab('members')}
        >
          <LayoutGrid className="w-4 h-4" /> Members
        </button>
        {isAdmin && (
          <button
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === 'groups'
                ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
            onClick={() => setTab('groups')}
          >
            <UsersRound className="w-4 h-4" /> Groups
          </button>
        )}
        <button
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'workload'
              ? 'border-brand-500 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
          onClick={() => setTab('workload')}
        >
          <BarChart2 className="w-4 h-4" /> Workload
        </button>
      </div>

      {tab === 'groups' && isAdmin && (
        <>
          <div className="relative mb-5">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              className="input pl-9"
              placeholder="Search groups…"
              value={groupSearch}
              onChange={(e) => setGroupSearch(e.target.value)}
            />
          </div>
          {filteredGroups.length === 0 ? (
            <EmptyState
              title="No groups yet"
              description="Create reusable teams to assign when creating projects or tasks"
              action={
                <button className="btn-primary" onClick={() => setShowCreateGroup(true)}>
                  Create Group
                </button>
              }
            />
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredGroups.map((g) => (
                <GroupCard
                  key={g._id}
                  group={g}
                  onEdit={() => setEditingGroup(g)}
                  onDelete={() => setDeletingGroup(g)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'members' && (
        <>
          <div className="relative mb-5">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              className="input pl-9"
              placeholder={isPM ? 'Search your team…' : 'Search team members…'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {isPM && groups.length > 0 && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Your team members from groups you lead ({groups.map((g) => g.name).join(', ')}).
            </p>
          )}
          {(isAdmin ? users : pmTeamMembers).length === 0 ? (
            <EmptyState
              title={isPM ? 'No team members yet' : 'No members found'}
              description={
                isPM
                  ? 'Ask an admin to create a group under you and add your team members.'
                  : 'Try a different search'
              }
            />
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(isAdmin ? users : pmTeamMembers).map((u) => (
                <MemberCard key={u._id} user={u} isMe={u._id === me?._id} />
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'workload' && (() => {
        const workload = dashSummary?.memberWorkload ?? [];
        return (
        <div className="space-y-6">
          {/* Workload summary table */}
          {workload.length > 0 && (
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Workload Summary</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-400 border-b border-slate-100 dark:border-slate-700">
                      <th className="pb-3 font-medium">Member</th>
                      <th className="pb-3 font-medium text-center">Total</th>
                      <th className="pb-3 font-medium text-center">Completed</th>
                      <th className="pb-3 font-medium text-center">In Progress</th>
                      <th className="pb-3 font-medium text-center">Todo</th>
                      <th className="pb-3 font-medium">Completion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {workload.map((m: any) => {
                      const pct = m.total > 0 ? Math.round((m.completed / m.total) * 100) : 0;
                      return (
                        <tr key={m.name} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2">
                              <Avatar name={m.name} size="sm" />
                              <span className="font-medium text-slate-800 dark:text-slate-200">{m.name}</span>
                            </div>
                          </td>
                          <td className="py-3 text-center text-slate-500 dark:text-slate-400">{m.total}</td>
                          <td className="py-3 text-center">
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">{m.completed}</span>
                          </td>
                          <td className="py-3 text-center">
                            <span className="text-blue-600 dark:text-blue-400 font-medium">{m.inProgress}</span>
                          </td>
                          <td className="py-3 text-center">
                            <span className="text-slate-500 dark:text-slate-400">{m.todo}</span>
                          </td>
                          <td className="py-3">
                            <div className="flex items-center gap-2 min-w-[100px]">
                              <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div className="h-full bg-brand-500 rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-xs text-slate-400 w-7 text-right">{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Workload filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Filter className="w-3.5 h-3.5" /> Filter tasks:
            </div>
            <select
              className="input py-1.5 text-xs w-auto min-w-[140px]"
              value={wlProject}
              onChange={(e) => setWlProject(e.target.value)}
            >
              <option value="">All Projects</option>
              {(projects as Project[]).map((p) => (
                <option key={p._id} value={p._id}>{p.name}</option>
              ))}
            </select>
            <select
              className="input py-1.5 text-xs w-auto min-w-[120px]"
              value={wlStatus}
              onChange={(e) => setWlStatus(e.target.value)}
            >
              <option value="">All Status</option>
              <option value="Todo">Todo</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
            </select>
            <select
              className="input py-1.5 text-xs w-auto min-w-[120px]"
              value={wlPriority}
              onChange={(e) => setWlPriority(e.target.value)}
            >
              <option value="">All Priority</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
            {(wlProject || wlStatus || wlPriority) && (
              <button
                className="text-xs text-brand-600 dark:text-brand-400 hover:underline"
                onClick={() => { setWlProject(''); setWlStatus(''); setWlPriority(''); }}
              >
                Clear filters
              </button>
            )}
          </div>

          {/* Member-wise task groups */}
          <div className={`space-y-6 transition-opacity duration-150 ${tasksFetching ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
          {tasksByMember.length === 0 ? (
            <EmptyState
              title="No assigned tasks"
              description={wlProject || wlStatus || wlPriority ? 'Try adjusting your filters' : 'No tasks have been assigned to any member yet'}
            />
          ) : (
            tasksByMember.map(({ user: assignee, tasks: memberTasks }) => (
              <div key={assignee?._id} className="card p-5">
                <div
                  className="flex items-center gap-3 mb-4 cursor-pointer group/header w-fit"
                  onClick={() => assignee && navigate(`/team/${assignee._id}`)}
                >
                  <Avatar name={assignee?.name || '?'} size="md" />
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white group-hover/header:text-brand-600 dark:group-hover/header:text-brand-400 transition-colors">
                      {assignee?.name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {memberTasks.length} task{memberTasks.length !== 1 ? 's' : ''} assigned
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  {memberTasks.map((task) => (
                    <div
                      key={task._id}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-sm"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-800 dark:text-slate-200 truncate">{task.title}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {typeof task.project === 'object' ? (task.project as any).name : ''}
                        </p>
                      </div>
                      <PriorityBadge priority={task.priority as TaskPriority} />
                      <TaskStatusBadge status={task.status as TaskStatus} />
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
          </div>
        </div>
        );
      })()}

      {(showCreateGroup || editingGroup) && (
        <GroupFormModal
          group={editingGroup}
          users={users}
          onClose={() => { setShowCreateGroup(false); setEditingGroup(null); }}
          onSubmit={(data) => {
            if (editingGroup) updateGroupMutation.mutate({ id: editingGroup._id, data });
            else createGroupMutation.mutate(data);
          }}
          loading={createGroupMutation.isPending || updateGroupMutation.isPending}
        />
      )}

      {deletingGroup && (
        <ConfirmModal
          title="Delete Group"
          description={`Delete "${deletingGroup.name}"? Existing projects keep their members — only the reusable template is removed.`}
          onConfirm={() => deleteGroupMutation.mutate(deletingGroup._id)}
          onCancel={() => setDeletingGroup(null)}
          loading={deleteGroupMutation.isPending}
        />
      )}
    </div>
  );
}

function GroupCard({
  group, onEdit, onDelete,
}: {
  group: TeamGroup;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const lead = typeof group.leadId === 'object' ? group.leadId : null;
  return (
    <div className="card p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 dark:text-white truncate">{group.name}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Lead: {lead?.name ?? '—'}
          </p>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button
            className="p-1.5 text-slate-400 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg"
            onClick={onEdit}
            title="Edit group"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
            onClick={onDelete}
            title="Delete group"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {lead && <Avatar name={lead.name} size="sm" />}
        {group.memberIds.map((m) => (
          <Avatar key={m._id} name={m.name} size="sm" />
        ))}
      </div>
      <p className="text-xs text-slate-400">
        {group.memberIds.length} team member{group.memberIds.length !== 1 ? 's' : ''} under {lead?.name ?? 'PM'}
      </p>
      {group.memberIds.length > 0 && (
        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
          {group.memberIds.map((m) => m.name).join(', ')}
        </p>
      )}
    </div>
  );
}

function GroupFormModal({
  group, users, onClose, onSubmit, loading,
}: {
  group: TeamGroup | null;
  users: User[];
  onClose: () => void;
  onSubmit: (data: CreateGroupInput) => void;
  loading: boolean;
}) {
  const leadDefault = group
    ? (typeof group.leadId === 'object' ? group.leadId._id : group.leadId)
    : '';
  const membersDefault = group ? group.memberIds.map((m) => m._id) : [];

  const [name, setName] = useState(group?.name || '');
  const [leadId, setLeadId] = useState(leadDefault);
  const [memberIds, setMemberIds] = useState<string[]>(membersDefault);

  const projectManagers = users.filter((u) => u.role === 'project_manager');
  const teamMemberOptions = users.filter((u) => u.role === 'member');

  const handleLeadChange = (id: string) => {
    setLeadId(id);
    setMemberIds((prev) => prev.filter((mid) => teamMemberOptions.some((m) => m._id === mid)));
  };

  const toggleMember = (id: string) => {
    setMemberIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !leadId) {
      toast.error('Name and PM lead are required');
      return;
    }
    if (memberIds.length === 0) {
      toast.error('Select at least one team member under this PM');
      return;
    }
    const combined = memberIds.includes(leadId) ? memberIds : [...memberIds, leadId];
    onSubmit({ name: name.trim(), leadId, memberIds: combined });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="card max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          {group ? 'Edit Group' : 'New Group'}
        </h2>
        <form onSubmit={handle} className="space-y-4">
          <div>
            <label className="label">Group name *</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              placeholder="e.g. Design Squad"
            />
          </div>
          <div>
            <label className="label">PM lead *</label>
            <select className="input" value={leadId} onChange={(e) => handleLeadChange(e.target.value)}>
              <option value="">Select PM</option>
              {projectManagers.map((u) => (
                <option key={u._id} value={u._id}>{u.name}</option>
              ))}
            </select>
            <p className="text-xs text-slate-400 mt-1">This PM will lead the group and its projects.</p>
          </div>
          <div>
            <label className="label">Team members under this PM *</label>
            <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
              {teamMemberOptions.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-2">No member-role users available.</p>
              ) : (
                teamMemberOptions.map((u) => (
                  <label key={u._id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={memberIds.includes(u._id)}
                      disabled={!leadId}
                      onChange={() => toggleMember(u._id)}
                    />
                    <span className="text-slate-700 dark:text-slate-300">{u.name}</span>
                    <span className="text-xs text-slate-400">({u.email})</span>
                  </label>
                ))
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              These members become this PM&apos;s team when the group is used on a project.
            </p>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-primary flex items-center gap-2" disabled={loading}>
              {loading && <Spinner size="sm" />}
              {loading ? 'Saving…' : group ? 'Save changes' : 'Create group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MemberCard({ user, isMe }: { user: User; isMe: boolean }) {
  const navigate = useNavigate();
  const joinedAt = user.createdAt ? new Date(user.createdAt) : null;
  const joinedLabel =
    joinedAt && !Number.isNaN(joinedAt.getTime())
      ? `Since ${format(joinedAt, 'MMM yyyy')}`
      : null;

  return (
    <div
      className="card p-5 flex flex-col gap-4 cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => navigate(`/team/${user._id}`)}
    >
      <div className="flex items-start gap-3">
        <Avatar name={user.name} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900 dark:text-white truncate">
            {user.name}
            {isMe && <span className="ml-2 text-xs text-brand-500">(you)</span>}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            <Mail className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{user.email}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_STYLES[user.role]}`}>
          {ROLE_LABELS[user.role]}
        </span>
        {joinedLabel && (
          <span className="text-xs text-slate-400">{joinedLabel}</span>
        )}
      </div>
    </div>
  );
}
