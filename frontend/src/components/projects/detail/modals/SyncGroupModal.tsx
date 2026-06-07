import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { UserMinus, UserPlus } from 'lucide-react';
import { projectsApi } from '@/services';
import { queryKeys } from '@/lib/query-keys';
import { Avatar, Spinner } from '@/components/shared';
import { toastApiError } from '@/lib/api-error';
import type { TeamGroup } from '@/types';

type SyncGroupModalProps = {
  projectId: string;
  projectTeamId?: string;
  linkedTeamName?: string;
  groups: TeamGroup[];
  onClose: () => void;
  onSuccess: () => void;
};

export function SyncGroupModal({
  projectId,
  projectTeamId,
  linkedTeamName,
  groups,
  onClose,
  onSuccess,
}: SyncGroupModalProps) {
  const [teamId, setTeamId] = useState(projectTeamId ?? groups[0]?._id ?? '');
  const [removeAbsent, setRemoveAbsent] = useState(false);
  const [updateLead, setUpdateLead] = useState(false);
  const [loading, setLoading] = useState(false);

  const { data: preview, isLoading, isFetching } = useQuery({
    queryKey: queryKeys.projects.syncPreview(projectId, teamId),
    queryFn: () => projectsApi.getSyncFromGroupPreview(projectId, teamId).then((r) => r.data),
    enabled: !!teamId,
  });

  useEffect(() => {
    setUpdateLead(!!preview?.leadChange.wouldChange);
  }, [preview?.leadChange.wouldChange, teamId]);

  const canApply =
    !!preview &&
    (preview.toAdd.length > 0 ||
      (removeAbsent && preview.toRemove.length > 0) ||
      (updateLead && preview.leadChange.wouldChange));

  const handleSync = async () => {
    if (!teamId) {
      toast.error('Select a group');
      return;
    }
    setLoading(true);
    try {
      await projectsApi.syncFromGroup(projectId, { teamId, removeAbsent, updateLead });
      toast.success('Group synced to project');
      onSuccess();
    } catch (err) {
      toastApiError(err, 'Failed to sync group');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="card max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Sync from group</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          Update this project&apos;s members to match the current group roster. Admin owner is never removed.
        </p>

        <div className="mb-4">
          <label className="label">Team group</label>
          {projectTeamId && linkedTeamName ? (
            <p className="input w-full bg-slate-50 dark:bg-slate-800/50 text-sm text-slate-700 dark:text-slate-300">
              {linkedTeamName}
            </p>
          ) : (
            <select className="input w-full" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              <option value="">Select a group…</option>
              {groups.map((g) => (
                <option key={g._id} value={g._id}>
                  {g.name}
                </option>
              ))}
            </select>
          )}
          {projectTeamId && (
            <p className="text-xs text-slate-400 mt-1">
              Linked team for this project — new group members can be pulled in here.
            </p>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : !teamId ? (
          <p className="text-sm text-slate-400 text-center py-4">Select a group to preview changes</p>
        ) : preview ? (
          <div className="space-y-4">
            {preview.inSync && !preview.leadChange.wouldChange ? (
              <p className="text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg px-3 py-2">
                Members match this group. No additions needed.
              </p>
            ) : (
              <>
                {preview.toAdd.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1">
                      <UserPlus className="w-3.5 h-3.5 text-emerald-500" />
                      Will be added ({preview.toAdd.length})
                    </p>
                    <ul className="space-y-1.5">
                      {preview.toAdd.map((u) => (
                        <li
                          key={u._id}
                          className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300"
                        >
                          <Avatar name={u.name} size="sm" />
                          <span className="truncate">{u.name}</span>
                          <span className="text-xs text-slate-400 capitalize">
                            {u.role.replace('_', ' ')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {preview.toRemove.length > 0 && (
                  <div>
                    <label className="flex items-start gap-2 cursor-pointer mb-2">
                      <input
                        type="checkbox"
                        className="mt-0.5 rounded border-slate-300"
                        checked={removeAbsent}
                        onChange={(e) => setRemoveAbsent(e.target.checked)}
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-300">
                        Remove members no longer in the group ({preview.toRemove.length})
                      </span>
                    </label>
                    {removeAbsent && (
                      <ul className="space-y-1.5 ml-6">
                        {preview.toRemove.map((u) => (
                          <li
                            key={u._id}
                            className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400"
                          >
                            <UserMinus className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="truncate">{u.name}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </>
            )}

            {preview.leadChange.wouldChange && preview.leadChange.to && (
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 rounded border-slate-300"
                  checked={updateLead}
                  onChange={(e) => setUpdateLead(e.target.checked)}
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  Set project lead to <strong>{preview.leadChange.to.name}</strong>
                  {preview.leadChange.from && <> (currently {preview.leadChange.from.name})</>}
                </span>
              </label>
            )}
          </div>
        ) : null}

        {isFetching && !isLoading && (
          <p className="text-xs text-slate-400 text-center mt-2">Updating preview…</p>
        )}

        <div className="flex gap-3 justify-end mt-6">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary flex items-center gap-2"
            onClick={handleSync}
            disabled={loading || !canApply}
          >
            {loading && <Spinner size="sm" />}
            {loading ? 'Syncing…' : 'Apply sync'}
          </button>
        </div>
      </div>
    </div>
  );
}
