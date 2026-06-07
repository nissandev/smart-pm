import { Clock, Plus, UserMinus, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Avatar } from '@/components/shared';
import { MemberActionButtons } from '@/components/projects/detail/MemberActionButtons';
import {
  canRemoveProjectMember,
  getProjectLeadId,
  getProjectOwnerId,
} from '@/utils/projectPermissions';
import { formatTeamLabel, getProjectTeamBreakdown } from '@/utils/projectTeam';
import type { Activity, Project, User } from '@/types';

type ProjectTeamSidebarProps = {
  project: Project;
  currentUser: User | null;
  recentActivity: Activity[];
  showActivity: boolean;
  showSyncButton: boolean;
  syncAvailable: boolean;
  syncPendingCount: number;
  canManage: boolean;
  onSync: () => void;
  onAddMember: () => void;
  onRemoveMember: (member: User) => void;
};

export function ProjectTeamSidebar({
  project,
  currentUser,
  recentActivity,
  showActivity,
  showSyncButton,
  syncAvailable,
  syncPendingCount,
  canManage,
  onSync,
  onAddMember,
  onRemoveMember,
}: ProjectTeamSidebarProps) {
  const members = project.members as User[];
  const projectOwnerId = getProjectOwnerId(project);
  const projectLeadId = getProjectLeadId(project);
  const teamBreakdown = getProjectTeamBreakdown(project);
  const leadUser =
    project.leadId && typeof project.leadId === 'object'
      ? (project.leadId as User)
      : members.find((m) => m._id === projectLeadId);
  const membersOnly = members.filter((m) => m._id !== projectLeadId);

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
            <Users className="w-4 h-4" />
            Team
            <span className="text-slate-400 font-normal">{formatTeamLabel(project)}</span>
            {syncAvailable && (
              <span
                className="w-2 h-2 rounded-full bg-amber-500 animate-pulse flex-shrink-0"
                title="Team group has updates to sync"
              />
            )}
          </h2>
          {showSyncButton && (
            <MemberActionButtons
              syncAvailable={syncAvailable}
              syncPendingCount={syncPendingCount}
              onSync={onSync}
              onAdd={onAddMember}
            />
          )}
          {canManage && !showSyncButton && (
            <button
              type="button"
              className="text-xs py-1.5 px-3 rounded-lg font-medium inline-flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white shadow-sm transition-colors flex-shrink-0"
              onClick={onAddMember}
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          )}
        </div>
        <div className="card divide-y divide-slate-100 dark:divide-slate-700/50">
          {teamBreakdown.totalPeople === 0 && !leadUser ? (
            <p className="text-xs text-slate-400 text-center py-4">No team members yet</p>
          ) : (
            <>
              {leadUser && (
                <div className="px-4 py-2 bg-brand-50/50 dark:bg-brand-950/20">
                  <p className="text-[10px] uppercase tracking-wide text-brand-600 dark:text-brand-400 font-semibold mb-2">
                    Project lead (PM)
                  </p>
                  <div className="flex items-center gap-3 pb-2">
                    <Avatar name={leadUser.name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {leadUser.name}
                      </p>
                      <p className="text-xs text-slate-400">Project Manager</p>
                    </div>
                  </div>
                </div>
              )}
              {membersOnly.length === 0 ? (
                leadUser ? null : (
                  <p className="text-xs text-slate-400 text-center py-4">No members yet</p>
                )
              ) : (
                <>
                  <p className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-wide text-slate-400 font-semibold">
                    Members ({membersOnly.length})
                  </p>
                  {membersOnly.map((m) => (
                    <div key={m._id} className="flex items-center gap-3 px-4 py-3">
                      <Avatar name={m.name} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                          {m.name}
                        </p>
                        <p className="text-xs text-slate-400 capitalize flex items-center gap-1.5">
                          <span>{m.role?.replace('_', ' ')}</span>
                          {m._id === projectOwnerId && (
                            <span className="text-purple-600 dark:text-purple-400 font-medium">
                              · Owner
                            </span>
                          )}
                        </p>
                      </div>
                      {canRemoveProjectMember(project, m, currentUser) && (
                        <button
                          type="button"
                          className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                          onClick={() => onRemoveMember(m)}
                          title="Remove member"
                        >
                          <UserMinus className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {showActivity && (
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5 mb-3">
            <Clock className="w-4 h-4" />
            Recent Activity
          </h2>
          <div className="card p-4">
            {recentActivity.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-2">No activity yet</p>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((a) => (
                  <div key={a._id} className="flex gap-2.5">
                    <Avatar name={(a.actor as User)?.name || '?'} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-snug">
                        {a.description}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
