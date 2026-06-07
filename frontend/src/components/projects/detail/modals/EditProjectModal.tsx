import { useState } from 'react';
import toast from 'react-hot-toast';
import { Spinner } from '@/components/shared';
import type { Project, ProjectStatus } from '@/types';

type EditProjectModalProps = {
  project: Project;
  loading: boolean;
  onClose: () => void;
  onSave: (data: Partial<Project>) => void;
};

export function EditProjectModal({ project, loading, onClose, onSave }: EditProjectModalProps) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? '');
  const [deadline, setDeadline] = useState(project.deadline.slice(0, 10));
  const [status, setStatus] = useState<ProjectStatus>(project.status);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (!deadline) {
      toast.error('Deadline is required');
      return;
    }
    onSave({
      name: name.trim(),
      description: description.trim() || undefined,
      deadline,
      status,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="card max-w-md w-full p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Edit Project</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Name *</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
            />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea
              className="input resize-none"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description…"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Deadline *</label>
              <input
                type="date"
                className="input"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
              />
            </div>
            <div>
              <label className="label">Status</label>
              <select
                className="input"
                value={status}
                onChange={(e) => setStatus(e.target.value as ProjectStatus)}
              >
                <option value="Active">Active</option>
                <option value="Completed">Completed</option>
                <option value="On Hold">On Hold</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-1">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-primary flex items-center gap-2" disabled={loading}>
              {loading && <Spinner size="sm" />}
              {loading ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
