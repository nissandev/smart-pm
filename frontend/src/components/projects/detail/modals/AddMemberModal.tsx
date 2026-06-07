import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { projectsApi } from '@/services';
import { useUsers } from '@/hooks';
import { Spinner } from '@/components/shared';
import { toastApiError } from '@/lib/api-error';
import type { TeamGroup } from '@/types';

type AddMemberModalProps = {
  projectId: string;
  isAdmin: boolean;
  canAssignLead: boolean;
  groups: TeamGroup[];
  existingMemberIds: string[];
  onClose: () => void;
  onSuccess: () => void;
};

export function AddMemberModal({
  projectId,
  isAdmin,
  canAssignLead,
  groups,
  existingMemberIds,
  onClose,
  onSuccess,
}: AddMemberModalProps) {
  const [mode, setMode] = useState<'individual' | 'group'>('individual');
  const [selectedId, setSelectedId] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [makeLead, setMakeLead] = useState(false);
  const [loading, setLoading] = useState(false);

  const { data: allUsers = [] } = useUsers(isAdmin);
  const available = allUsers.filter((u) => !existingMemberIds.includes(u._id));
  const selectedUser = available.find((u) => u._id === selectedId);
  const canMakeLeadIndividual = canAssignLead && selectedUser?.role === 'project_manager';

  const selectedGroup = groups.find((g) => g._id === selectedGroupId);
  const groupNewCount = useMemo(() => {
    if (!selectedGroup) return 0;
    const existing = new Set(existingMemberIds);
    const leadId =
      typeof selectedGroup.leadId === 'object' ? selectedGroup.leadId._id : selectedGroup.leadId;
    const ids = new Set<string>([String(leadId)]);
    for (const m of selectedGroup.memberIds) ids.add(m._id);
    return [...ids].filter((id) => !existing.has(id)).length;
  }, [selectedGroup, existingMemberIds]);

  const canMakeLeadGroup = canAssignLead && !!selectedGroup;

  const handleAdd = async () => {
    setLoading(true);
    try {
      if (mode === 'group') {
        if (!selectedGroupId) {
          toast.error('Select a group');
          return;
        }
        await projectsApi.addMembersFromGroup(projectId, selectedGroupId, {
          makeLead: canMakeLeadGroup && makeLead,
        });
        toast.success(
          makeLead && canMakeLeadGroup
            ? 'Group added and PM set as project lead'
            : 'Group members added',
        );
      } else {
        if (!selectedId) {
          toast.error('Select a user');
          return;
        }
        await projectsApi.addMember(projectId, selectedId, {
          makeLead: canMakeLeadIndividual && makeLead,
        });
        toast.success(
          makeLead && canMakeLeadIndividual
            ? 'Member added and set as project lead'
            : 'Member added',
        );
      }
      onSuccess();
    } catch (err) {
      toastApiError(err, 'Failed to add member');
    } finally {
      setLoading(false);
    }
  };

  const canSubmit =
    mode === 'group' ? !!selectedGroupId && groupNewCount > 0 : !!selectedId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="card max-w-md w-full p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Add Members</h2>

        <div className="flex gap-1 mb-4 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
          <button
            type="button"
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
              mode === 'individual'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
            onClick={() => {
              setMode('individual');
              setMakeLead(false);
            }}
          >
            Individual
          </button>
          {groups.length > 0 && (
            <button
              type="button"
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                mode === 'group'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
              onClick={() => {
                setMode('group');
                setMakeLead(false);
                setSelectedId('');
              }}
            >
              From group
            </button>
          )}
        </div>

        {mode === 'individual' ? (
          available.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">All users are already members</p>
          ) : (
            <select
              className="input w-full mb-4"
              value={selectedId}
              onChange={(e) => {
                setSelectedId(e.target.value);
                setMakeLead(false);
              }}
            >
              <option value="">Select a user…</option>
              {available.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name} ({u.role.replace('_', ' ')})
                </option>
              ))}
            </select>
          )
        ) : (
          <>
            <select
              className="input w-full mb-2"
              value={selectedGroupId}
              onChange={(e) => {
                setSelectedGroupId(e.target.value);
                setMakeLead(false);
              }}
            >
              <option value="">Select a group…</option>
              {groups.map((g) => (
                <option key={g._id} value={g._id}>
                  {g.name}
                </option>
              ))}
            </select>
            {selectedGroup && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                {groupNewCount > 0
                  ? `${groupNewCount} new member${groupNewCount !== 1 ? 's' : ''} will be added (already on project are skipped).`
                  : 'All members of this group are already on the project.'}
              </p>
            )}
          </>
        )}

        {((mode === 'individual' && canMakeLeadIndividual) ||
          (mode === 'group' && canMakeLeadGroup)) && (
          <label className="flex items-start gap-2 mb-4 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1 rounded border-slate-300"
              checked={makeLead}
              onChange={(e) => setMakeLead(e.target.checked)}
            />
            <span className="text-sm text-slate-600 dark:text-slate-300">
              {mode === 'group' ? 'Make group PM the project lead' : 'Make this PM the project lead'}
              <span className="block text-xs text-slate-400 mt-0.5">
                Full project control. The admin owner is unchanged.
              </span>
            </span>
          </label>
        )}

        <div className="flex gap-3 justify-end">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          {(mode === 'group' || available.length > 0) && (
            <button
              type="button"
              className="btn-primary flex items-center gap-2"
              onClick={handleAdd}
              disabled={loading || !canSubmit}
            >
              {loading && <Spinner size="sm" />}
              {loading ? 'Adding…' : mode === 'group' ? 'Add Group' : 'Add Member'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
