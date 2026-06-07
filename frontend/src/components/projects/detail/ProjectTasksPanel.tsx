import { useNavigate } from 'react-router-dom';
import { Calendar, Edit2, Search, Trash2 } from 'lucide-react';
import { format, isPast } from 'date-fns';
import {
  Avatar, EmptyState, PriorityBadge, Spinner,
} from '@/components/shared';
import { getTaskEditMode } from '@/utils/taskPermissions';
import type { Task, TaskPriority, TaskStatus, User } from '@/types';

type ProjectTasksPanelProps = {
  tasks: Task[];
  filteredTasks: Task[];
  tasksLoading: boolean;
  canManage: boolean;
  currentUser: User | null;
  search: string;
  statusFilter: string;
  priorityFilter: string;
  statusUpdating: string | null;
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  onPriorityFilterChange: (value: string) => void;
  onAddTask: () => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  canChangeTaskStatus: (task: Task) => boolean;
};

export function ProjectTasksPanel({
  tasks,
  filteredTasks,
  tasksLoading,
  canManage,
  currentUser,
  search,
  statusFilter,
  priorityFilter,
  statusUpdating,
  onSearchChange,
  onStatusFilterChange,
  onPriorityFilterChange,
  onAddTask,
  onEditTask,
  onDeleteTask,
  onStatusChange,
  canChangeTaskStatus,
}: ProjectTasksPanelProps) {
  const navigate = useNavigate();

  return (
    <>
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[140px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input
            className="input pl-8 py-1.5 text-xs"
            placeholder="Search tasks…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <select
          className="input py-1.5 text-xs w-auto min-w-[110px]"
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
        >
          <option value="">All Status</option>
          <option value="Todo">Todo</option>
          <option value="In Progress">In Progress</option>
          <option value="Completed">Completed</option>
        </select>
        <select
          className="input py-1.5 text-xs w-auto min-w-[110px]"
          value={priorityFilter}
          onChange={(e) => onPriorityFilterChange(e.target.value)}
        >
          <option value="">All Priority</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
      </div>

      {tasksLoading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : tasks.length === 0 ? (
        <EmptyState
          title="No tasks yet"
          description="Add the first task to get started"
          action={
            canManage ? (
              <button type="button" className="btn-primary" onClick={onAddTask}>
                Add Task
              </button>
            ) : undefined
          }
        />
      ) : filteredTasks.length === 0 ? (
        <div className="text-center py-10 text-sm text-slate-400">No tasks match your filters</div>
      ) : (
        <>
          {filteredTasks.map((task) => (
            <div key={task._id} className="card px-4 py-3 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => navigate(`/tasks/${task._id}`)}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-slate-900 dark:text-white hover:text-brand-600 dark:hover:text-brand-400 transition-colors truncate">
                      {task.title}
                    </p>
                    <PriorityBadge priority={task.priority as TaskPriority} />
                  </div>
                  {task.dueDate && (
                    <span
                      className={`flex items-center gap-1 text-xs mt-0.5 ${
                        task.status !== 'Completed' && isPast(new Date(task.dueDate))
                          ? 'text-red-400'
                          : 'text-slate-400'
                      }`}
                    >
                      <Calendar className="w-3 h-3" />
                      {format(new Date(task.dueDate), 'MMM d, yyyy')}
                      {task.status !== 'Completed' && isPast(new Date(task.dueDate)) && (
                        <span className="font-medium"> · Overdue</span>
                      )}
                    </span>
                  )}
                </div>

                <div
                  className="flex items-center gap-2 flex-shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  {statusUpdating === task._id ? (
                    <Spinner size="sm" />
                  ) : (
                    <select
                      className={`text-xs border rounded-full px-2.5 py-0.5 font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-brand-500 transition-colors appearance-none ${
                        task.status === 'Todo'
                          ? 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                          : task.status === 'In Progress'
                            ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800'
                            : 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800'
                      } ${!canChangeTaskStatus(task) ? 'opacity-60 cursor-not-allowed' : ''}`}
                      value={task.status}
                      disabled={!canChangeTaskStatus(task)}
                      onChange={(e) => onStatusChange(task._id, e.target.value as TaskStatus)}
                    >
                      <option value="Todo">Todo</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                    </select>
                  )}

                  {task.assignedTo && (
                    <div title={(task.assignedTo as User).name}>
                      <Avatar name={(task.assignedTo as User).name} size="sm" />
                    </div>
                  )}

                  {(() => {
                    const mode = getTaskEditMode(task, currentUser);
                    if (mode === 'none') return null;
                    return (
                      <>
                        <button
                          type="button"
                          className="p-1 text-slate-400 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded transition-colors"
                          onClick={() => onEditTask(task)}
                          title={mode === 'delegate' ? 'Reassign task' : 'Edit task'}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {mode === 'full' && (
                          <button
                            type="button"
                            className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                            onClick={() => onDeleteTask(task)}
                            title="Delete task"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          ))}

          {(search || statusFilter || priorityFilter) && (
            <p className="text-xs text-slate-400 text-center">
              Showing {filteredTasks.length} of {tasks.length} tasks
            </p>
          )}
        </>
      )}
    </>
  );
}
