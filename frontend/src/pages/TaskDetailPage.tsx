import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Calendar, Send, Trash2, Edit2, Check, X,
  Paperclip, Upload, FileText, Image as ImageIcon, File as FileIcon, Download,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format, isPast, formatDistanceToNow } from 'date-fns';
import { tasksApi } from '../services';
import { fileUrl } from '../services/api';
import { useAuthStore } from '../store/authStore';
import {
  LoadingScreen, PriorityBadge, TaskStatusBadge, ConfirmModal, Avatar, Spinner,
} from '../components/shared';
import type { Task, TaskStatus, TaskPriority, User, Project, TaskAttachment } from '../types';

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user: me } = useAuthStore();

  const [comment, setComment] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);

  const { data: task, isLoading } = useQuery({
    queryKey: ['task', id],
    queryFn: () => tasksApi.getById(id!).then((r) => r.data),
    enabled: !!id,
  });

  const statusMutation = useMutation({
    mutationFn: (status: TaskStatus) => tasksApi.update(id!, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task', id] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Status updated');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to update status'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => tasksApi.delete(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      navigate('/tasks');
      toast.success('Task deleted');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to delete task'),
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => tasksApi.deleteComment(id!, commentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task', id] });
      setDeletingCommentId(null);
      toast.success('Comment deleted');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to delete comment'),
  });

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    setSendingComment(true);
    try {
      await tasksApi.addComment(id!, comment.trim());
      qc.invalidateQueries({ queryKey: ['task', id] });
      setComment('');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to post comment');
    } finally {
      setSendingComment(false);
    }
  };

  const handleEditComment = async (commentId: string) => {
    if (!editingCommentText.trim()) return;
    try {
      await tasksApi.updateComment(id!, commentId, editingCommentText.trim());
      qc.invalidateQueries({ queryKey: ['task', id] });
      setEditingCommentId(null);
      toast.success('Comment updated');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to update comment');
    }
  };

  if (isLoading) return <LoadingScreen />;
  if (!task) return <div className="text-center py-16 text-slate-400">Task not found</div>;

  const assignedUser = task.assignedTo as User | undefined;
  const project = task.project as Project;
  const overdue = task.status !== 'Completed' && isPast(new Date(task.dueDate));
  const canManage = me?.role !== 'member' || assignedUser?._id === me?._id;
  const canDelete = me?.role === 'admin' || (me?.role === 'project_manager');

  return (
    <div className="max-w-3xl mx-auto">
      <button
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-5 transition-colors"
        onClick={() => navigate(-1)}
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* Header card */}
      <div className="card p-6 mb-4">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
              {typeof project === 'object' ? project.name : 'Project'}
            </p>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white leading-snug">{task.title}</h1>
          </div>
          {canDelete && (
            <button
              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex-shrink-0"
              onClick={() => setShowDelete(true)}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {task.description && (
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-5 leading-relaxed">{task.description}</p>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-slate-400 mb-1.5">Status</p>
            {canManage ? (
              <select
                className="text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={task.status}
                onChange={(e) => statusMutation.mutate(e.target.value as TaskStatus)}
              >
                <option>Todo</option>
                <option>In Progress</option>
                <option>Completed</option>
              </select>
            ) : (
              <TaskStatusBadge status={task.status as TaskStatus} />
            )}
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1.5">Priority</p>
            <PriorityBadge priority={task.priority as TaskPriority} />
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1.5">Due Date</p>
            <span className={`flex items-center gap-1 text-xs font-medium ${overdue ? 'text-red-500' : 'text-slate-600 dark:text-slate-300'}`}>
              <Calendar className="w-3.5 h-3.5" />
              {format(new Date(task.dueDate), 'MMM d, yyyy')}
              {overdue && ' · Overdue'}
            </span>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1.5">Assigned To</p>
            {assignedUser ? (
              <div className="flex items-center gap-1.5">
                <Avatar name={assignedUser.name} size="sm" />
                <span className="text-xs text-slate-700 dark:text-slate-300 truncate">{assignedUser.name}</span>
              </div>
            ) : (
              <span className="text-xs text-slate-400">Unassigned</span>
            )}
          </div>
        </div>
      </div>

      {/* Attachments */}
      <AttachmentsCard task={task} />

      {/* Comments */}
      <div className="card p-6">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
          Comments ({task.comments?.length || 0})
        </h2>

        {task.comments?.length === 0 && (
          <p className="text-xs text-slate-400 py-4 text-center">No comments yet. Start the conversation.</p>
        )}

        <div className="space-y-4 mb-5">
          {task.comments?.map((c: any) => {
            const isAuthor = me?._id === c.author?._id;
            const isEditing = editingCommentId === c._id;
            const canDeleteComment = isAuthor || me?.role === 'admin';

            return (
              <div key={c._id} className="flex items-start gap-3 group">
                <Avatar name={c.author?.name || '?'} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{c.author?.name}</p>
                    <p className="text-xs text-slate-400">
                      {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                    </p>
                    {canDeleteComment && !isEditing && (
                      <div className="ml-auto flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isAuthor && (
                          <button
                            className="p-1 text-slate-400 hover:text-brand-500 rounded transition-colors"
                            onClick={() => { setEditingCommentId(c._id); setEditingCommentText(c.text); }}
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors"
                          onClick={() => setDeletingCommentId(c._id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                  {isEditing ? (
                    <div className="flex gap-2">
                      <input
                        className="input flex-1 text-sm"
                        value={editingCommentText}
                        onChange={(e) => setEditingCommentText(e.target.value)}
                        autoFocus
                      />
                      <button
                        className="p-1.5 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded transition-colors"
                        onClick={() => handleEditComment(c._id)}
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                        onClick={() => setEditingCommentId(null)}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-snug">{c.text}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <form onSubmit={handleComment} className="flex gap-2">
          <Avatar name={me?.name || '?'} size="sm" />
          <div className="flex-1 flex gap-2">
            <input
              className="input flex-1 text-sm"
              placeholder="Write a comment…"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <button type="submit" className="btn-primary px-3" disabled={sendingComment || !comment.trim()}>
              {sendingComment ? <Spinner size="sm" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </form>
      </div>

      {showDelete && (
        <ConfirmModal
          title="Delete Task"
          description={`Delete "${task.title}"? This cannot be undone.`}
          onConfirm={() => deleteMutation.mutate()}
          onCancel={() => setShowDelete(false)}
          loading={deleteMutation.isPending}
        />
      )}

      {deletingCommentId && (
        <ConfirmModal
          title="Delete Comment"
          description="Delete this comment? This cannot be undone."
          onConfirm={() => deleteCommentMutation.mutate(deletingCommentId)}
          onCancel={() => setDeletingCommentId(null)}
          loading={deleteCommentMutation.isPending}
        />
      )}
    </div>
  );
}

// ── AttachmentsCard ───────────────────────────────────────────────
function AttachmentsCard({ task }: { task: Task }) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const { user: me } = useAuthStore();
  const [uploading, setUploading] = useState(false);
  const [removingIdx, setRemovingIdx] = useState<number | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ['task', task._id] });

  const handlePickFile = () => inputRef.current?.click();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) {
      toast.error('File too large (max 10 MB)');
      return;
    }
    setUploading(true);
    try {
      await tasksApi.uploadAttachment(task._id, f);
      toast.success('File attached');
      refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async (idx: number) => {
    setRemovingIdx(idx);
    try {
      await tasksApi.deleteAttachment(task._id, idx);
      toast.success('Attachment removed');
      refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to remove');
    } finally {
      setRemovingIdx(null);
    }
  };

  const canRemove = (a: TaskAttachment): boolean => {
    if (!me) return false;
    if (me.role === 'admin') return true;
    const ownerId = typeof a.uploadedBy === 'object' ? (a.uploadedBy as User)?._id : (a.uploadedBy as string | undefined);
    if (ownerId === me._id) return true;
    // PM check: we don't know if me created the project here without extra fetch — fall back to role.
    return false;
  };

  return (
    <div className="card p-6 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <Paperclip className="w-4 h-4 text-slate-400" />
          Attachments ({task.attachments?.length || 0})
        </h2>
        <button
          type="button"
          className="btn-secondary text-xs flex items-center gap-1.5 py-1.5"
          onClick={handlePickFile}
          disabled={uploading}
        >
          {uploading ? <Spinner size="sm" /> : <Upload className="w-3.5 h-3.5" />}
          {uploading ? 'Uploading…' : 'Upload'}
        </button>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={handleUpload}
          accept=".png,.jpg,.jpeg,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
        />
      </div>

      {(!task.attachments || task.attachments.length === 0) ? (
        <p className="text-xs text-slate-400 text-center py-4">
          No attachments yet. Upload a file (max 10 MB).
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-700/50">
          {task.attachments.map((a, idx) => (
            <li key={`${a.url}-${idx}`} className="flex items-center gap-3 py-2.5 group">
              <FileTypeIcon mimeType={a.mimeType} />
              <div className="flex-1 min-w-0">
                <a
                  href={fileUrl(a.url)}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-sm font-medium text-slate-800 dark:text-slate-200 hover:text-brand-600 dark:hover:text-brand-400 truncate block"
                  title={a.name}
                >
                  {a.name}
                </a>
                <p className="text-xs text-slate-400 mt-0.5">
                  {a.size != null && <span>{prettySize(a.size)}</span>}
                  {a.uploadedAt && (
                    <>
                      {a.size != null && <span className="mx-1.5">·</span>}
                      <span>{formatDistanceToNow(new Date(a.uploadedAt), { addSuffix: true })}</span>
                    </>
                  )}
                </p>
              </div>
              <a
                href={fileUrl(a.url)}
                target="_blank"
                rel="noreferrer noopener"
                className="p-1.5 text-slate-400 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded transition-colors"
                title="Download"
              >
                <Download className="w-3.5 h-3.5" />
              </a>
              {canRemove(a) && (
                <button
                  type="button"
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                  onClick={() => handleRemove(idx)}
                  disabled={removingIdx === idx}
                  title="Remove"
                >
                  {removingIdx === idx ? <Spinner size="sm" /> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FileTypeIcon({ mimeType }: { mimeType?: string }) {
  if (!mimeType) return <FileIcon className="w-5 h-5 text-slate-400" />;
  if (mimeType.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-emerald-500" />;
  if (mimeType === 'application/pdf' || mimeType.includes('text') || mimeType.includes('csv')) {
    return <FileText className="w-5 h-5 text-red-500" />;
  }
  return <FileIcon className="w-5 h-5 text-blue-500" />;
}

function prettySize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
