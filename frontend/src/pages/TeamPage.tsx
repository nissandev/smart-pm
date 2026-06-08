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
  admin: 'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400',
  project_manager: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
  member: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
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
  const isMember = me?.role === 'member';

  const { data: groups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ['groups'],
    queryFn: ({ signal }) => groupsApi.getAll(signal).then((r) => r.data),
    enabled: (isAdmin && tab === 'groups') || (isPM && tab === 'members') || isMember,
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
        <PageHeader title="Team" subtitle="Your groups" />
        <div className="card p-5 flex items-center gap-4 mb-6">
          <Avatar name={me?.name || '?'} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-slate-900 dark:text-white">{me?.name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{me?.email}</p>
            <span className={`mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_STYLES[me!.role]}`}>
              {ROLE_LABELS[me!.role]}
            </span>
          </div>
          <button className="btn-secondary text-xs flex-shrink-0" onClick={() => navigate('/projects')}>
            Projects
          </button>
        </div>

        {groups.length === 0 ? (
          <div className="card p-10 flex flex-col items-center text-center">
            <UsersRound className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              You haven&apos;t been added to any group yet.
            </p>
            <p className="text-xs text-slate-400 mt-1">An admin will assign you to a group.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Groups you&apos;re included in
            </p>
            {groups.map((g) => (
              <MemberGroupCard key={g._id} group={g} myId={me!._id} />
            ))}
          </div>
        )}
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
            <div className="flex flex-wrap gap-2 justify-end">
              {tab === 'groups' && (
                <button className="btn-primary text-sm" onClick={() => setShowCreateGroup(true)}>
                  <Plus className="w-4 h-4" />
                  <span className="hidden xs:inline">New Group</span>
                  <span className="xs:hidden">New</span>
                </button>
              )}
              <button className="btn-secondary text-sm" onClick={() => navigate('/users')}>
                <span className="hidden sm:inline">Manage Users</span>
                <span className="sm:hidden">Users</span>
              </button>
            </div>
          ) : undefined
        }
      />

      {/* Tabs */}
      <div className="flex mb-5 border-b border-slate-200 dark:border-white/[0.08] overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {(
          [
            { id: 'members', label: 'Members', icon: LayoutGrid },
            ...(isAdmin ? [{ id: 'groups', label: 'Groups', icon: UsersRound }] : []),
            { id: 'workload', label: 'Workload', icon: BarChart2 },
          ] as { id: typeof tab; label: string; icon: typeof LayoutGrid }[]
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 sm:px-5 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors flex-shrink-0 ${
              tab === id
                ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-white/[0.15]'
            }`}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span>{label}</span>
          </button>
        ))}
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
                    <tr className="text-left text-xs text-slate-400 border-b border-slate-100 dark:border-white/[0.06]">
                      <th className="pb-3 font-semibold">Member</th>
                      <th className="pb-3 font-semibold text-center">Total</th>
                      <th className="pb-3 font-semibold text-center">Completed</th>
                      <th className="pb-3 font-semibold text-center hidden sm:table-cell">In Progress</th>
                      <th className="pb-3 font-semibold text-center hidden sm:table-cell">Todo</th>
                      <th className="pb-3 font-semibold">Completion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                    {workload.map((m: any) => {
                      const pct = m.total > 0 ? Math.round((m.completed / m.total) * 100) : 0;
                      return (
                        <tr key={m.name} className="hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors">
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
                          <td className="py-3 text-center hidden sm:table-cell">
                            <span className="text-blue-600 dark:text-blue-400 font-medium">{m.inProgress}</span>
                          </td>
                          <td className="py-3 text-center hidden sm:table-cell">
                            <span className="text-slate-500 dark:text-slate-400">{m.todo}</span>
                          </td>
                          <td className="py-3">
                            <div className="flex items-center gap-2 min-w-[80px] sm:min-w-[100px]">
                              <div className="flex-1 h-1.5 bg-slate-100 dark:bg-white/[0.08] rounded-full overflow-hidden">
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
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 flex-shrink-0">
              <Filter className="w-3.5 h-3.5" /> Filter tasks:
            </div>
            <div className="flex gap-2 overflow-x-auto pb-0.5 sm:flex-wrap sm:overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <select
                className="input !w-auto flex-shrink-0 py-1.5 text-xs min-w-[130px] sm:w-[150px]"
                value={wlProject}
                onChange={(e) => setWlProject(e.target.value)}
              >
                <option value="">All Projects</option>
                {(projects as Project[]).map((p) => (
                  <option key={p._id} value={p._id}>{p.name}</option>
                ))}
              </select>
              <select
                className="input !w-auto flex-shrink-0 py-1.5 text-xs min-w-[110px] sm:w-[130px]"
                value={wlStatus}
                onChange={(e) => setWlStatus(e.target.value)}
              >
                <option value="">All Status</option>
                <option value="Todo">Todo</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
              </select>
              <select
                className="input !w-auto flex-shrink-0 py-1.5 text-xs min-w-[110px] sm:w-[130px]"
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
                  className="flex-shrink-0 text-xs text-brand-600 dark:text-brand-400 hover:underline px-1"
                  onClick={() => { setWlProject(''); setWlStatus(''); setWlPriority(''); }}
                >
                  Clear
                </button>
              )}
            </div>
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
                      className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-transparent dark:border-white/[0.04] text-sm"
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
            className="p-1.5 text-slate-400 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/10 rounded-lg transition-colors"
            onClick={onEdit}
            title="Edit group"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
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

function MemberGroupCard({ group, myId }: { group: TeamGroup; myId: string }) {
  const lead = typeof group.leadId === 'object' ? group.leadId : null;
  return (
    <div className="card p-5">
      <p className="font-semibold text-slate-900 dark:text-white mb-4">{group.name}</p>
      <div className="space-y-2">
        {lead && (
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border text-sm bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/25">
            <Avatar name={lead.name} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-amber-700 dark:text-amber-400 truncate">
                {lead.name}
              </p>
            </div>
            <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/20 px-2 py-0.5 rounded-full flex-shrink-0">
              Lead
            </span>
          </div>
        )}
        {group.memberIds.map((member) => {
          const isMe = member._id === myId;
          return (
            <div
              key={member._id}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border text-sm ${
                isMe
                  ? 'bg-brand-50 dark:bg-brand-500/10 border-brand-200 dark:border-brand-500/20'
                  : 'bg-slate-50 dark:bg-white/[0.03] border-slate-100 dark:border-white/[0.04] opacity-60 cursor-not-allowed select-none'
              }`}
            >
              <Avatar name={member.name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className={`font-medium truncate ${isMe ? 'text-brand-700 dark:text-brand-400' : 'text-slate-500 dark:text-slate-400'}`}>
                  {member.name}
                  {isMe && <span className="ml-1.5 text-xs font-normal">(you)</span>}
                </p>
              </div>
              {!isMe && (
                <span className="text-[11px] text-slate-400 flex-shrink-0">Tasks hidden</span>
              )}
            </div>
          );
        })}
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
