import { useMemo, useState, useEffect, useCallback, useRef, memo } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  closestCorners,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { format, isPast } from 'date-fns';
import {
  Calendar, Edit2, Trash2, GripVertical, Circle, Loader2, CheckCircle2,
  ChevronLeft, ChevronRight, ArrowRight,
} from 'lucide-react';
import type { Task, TaskPriority, TaskStatus, Project, User } from '../../types';
import { canChangeTaskStatus, getTaskEditMode } from '../../utils/taskPermissions';
import { PriorityBadge, Avatar, Spinner } from '../shared';

const COLUMNS: {
  id: TaskStatus;
  label: string;
  shortLabel: string;
  icon: typeof Circle;
  accent: string;
  tabActive: string;
  headerBg: string;
  dropRing: string;
}[] = [
  {
    id: 'Todo',
    label: 'To Do',
    shortLabel: 'To Do',
    icon: Circle,
    accent: 'border-t-slate-400',
    tabActive: 'bg-slate-600 dark:bg-white/[0.12] text-white',
    headerBg: 'bg-slate-50/80 dark:bg-white/[0.02]',
    dropRing: 'ring-slate-400/50',
  },
  {
    id: 'In Progress',
    label: 'In Progress',
    shortLabel: 'Active',
    icon: Loader2,
    accent: 'border-t-blue-500',
    tabActive: 'bg-blue-600 dark:bg-blue-500/80 text-white',
    headerBg: 'bg-blue-50/80 dark:bg-blue-500/[0.06]',
    dropRing: 'ring-blue-400/50',
  },
  {
    id: 'Completed',
    label: 'Completed',
    shortLabel: 'Done',
    icon: CheckCircle2,
    accent: 'border-t-emerald-500',
    tabActive: 'bg-emerald-600 dark:bg-emerald-500/80 text-white',
    headerBg: 'bg-emerald-50/80 dark:bg-emerald-500/[0.06]',
    dropRing: 'ring-emerald-400/50',
  },
];

const STATUS_FLOW: Record<TaskStatus, { next?: TaskStatus; prev?: TaskStatus; nextLabel?: string; prevLabel?: string }> = {
  Todo: { next: 'In Progress', nextLabel: 'Start' },
  'In Progress': { prev: 'Todo', prevLabel: 'To Do', next: 'Completed', nextLabel: 'Complete' },
  Completed: { prev: 'In Progress', prevLabel: 'Reopen' },
};

const PRIORITY_ORDER: Record<string, number> = { High: 0, Medium: 1, Low: 2 };

function useIsMobileBoard() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : false,
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return isMobile;
}

function sortTasks(tasks: Task[], sortBy: string): Task[] {
  return [...tasks].sort((a, b) => {
    if (sortBy === 'deadline')
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    if (sortBy === 'priority')
      return (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3);
    if (sortBy === 'updated')
      return (
        new Date(b.updatedAt || b.createdAt).getTime() -
        new Date(a.updatedAt || a.createdAt).getTime()
      );
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export function TaskKanbanBoard({
  tasks,
  me,
  sortBy,
  isFetching,
  onStatusChange,
  onEdit,
  onDelete,
  onNavigate,
}: {
  tasks: Task[];
  me: User | null | undefined;
  sortBy: string;
  isFetching?: boolean;
  onStatusChange: (task: Task, status: TaskStatus) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onNavigate: (task: Task) => void;
}) {
  const isMobile = useIsMobileBoard();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<TaskStatus | null>(null);
  const [mobileColumn, setMobileColumn] = useState<TaskStatus>('Todo');
  const scrollRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

  const tasksByStatus = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = {
      Todo: [],
      'In Progress': [],
      Completed: [],
    };
    for (const t of sortTasks(tasks, sortBy)) {
      if (map[t.status]) map[t.status].push(t);
    }
    return map;
  }, [tasks, sortBy]);

  const activeTask = activeId ? tasks.find((t) => t._id === activeId) : null;
  const mobileColIndex = COLUMNS.findIndex((c) => c.id === mobileColumn);

  const goToMobileColumn = useCallback((dir: -1 | 1) => {
    const next = COLUMNS[mobileColIndex + dir];
    if (next) setMobileColumn(next.id);
  }, [mobileColIndex]);

  const handleStatusChange = useCallback(
    (task: Task, status: TaskStatus) => {
      onStatusChange(task, status);
      if (isMobile) setMobileColumn(status);
    },
    [onStatusChange, isMobile],
  );

  const handleDragStart = useCallback((e: DragStartEvent) => {
    setActiveId(String(e.active.id));
  }, []);

  const handleDragOver = useCallback((e: DragOverEvent) => {
    const overId = e.over?.id;
    if (!overId) {
      setOverColumn(null);
      return;
    }
    const id = String(overId);
    if (COLUMNS.some((c) => c.id === id)) {
      setOverColumn(id as TaskStatus);
      return;
    }
    const task = tasks.find((t) => t._id === id);
    setOverColumn(task?.status ?? null);
  }, [tasks]);

  const handleDragEnd = useCallback((e: DragEndEvent) => {
    setActiveId(null);
    setOverColumn(null);
    const { active, over } = e;
    if (!over) return;

    const taskId = String(active.id);
    const task = tasks.find((t) => t._id === taskId);
    if (!task || !canChangeTaskStatus(task, me)) return;

    let targetStatus: TaskStatus | null = null;
    const overId = String(over.id);
    if (COLUMNS.some((c) => c.id === overId)) {
      targetStatus = overId as TaskStatus;
    } else {
      const overTask = tasks.find((t) => t._id === overId);
      targetStatus = overTask?.status ?? null;
    }

    if (targetStatus && targetStatus !== task.status) {
      handleStatusChange(task, targetStatus);
    }
  }, [tasks, me, handleStatusChange]);

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    setOverColumn(null);
  }, []);

  const visibleColumns = isMobile
    ? COLUMNS.filter((c) => c.id === mobileColumn)
    : COLUMNS;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragCancel={handleDragCancel}
    >
      <div className={`relative transition-opacity duration-150 ${isFetching ? 'opacity-60' : ''}`}>
        {isFetching && (
          <div className="absolute top-3 right-3 z-20">
            <Spinner size="sm" />
          </div>
        )}

        {/* Mobile: column tabs + swipe nav */}
        {isMobile && (
          <div className="mb-3 space-y-2">
            <div className="flex gap-1 p-1 rounded-xl bg-slate-100/80 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.06]">
              {COLUMNS.map((col) => (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => setMobileColumn(col.id)}
                  className={`flex-1 min-w-0 py-2 px-1.5 rounded-lg text-xs font-semibold transition-all truncate ${
                    mobileColumn === col.id
                      ? col.tabActive
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  {col.shortLabel}
                  <span className="ml-1 opacity-80">({tasksByStatus[col.id].length})</span>
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between px-1">
              <button
                type="button"
                disabled={mobileColIndex === 0}
                onClick={() => goToMobileColumn(-1)}
                className="inline-flex items-center gap-0.5 text-xs font-medium text-slate-500 disabled:opacity-30 py-2 px-2 -ml-2"
              >
                <ChevronLeft className="w-4 h-4" />
                {mobileColIndex > 0 ? COLUMNS[mobileColIndex - 1].shortLabel : ''}
              </button>
              <p className="text-[11px] text-slate-400 text-center">
                Tap buttons on cards to move status
              </p>
              <button
                type="button"
                disabled={mobileColIndex === COLUMNS.length - 1}
                onClick={() => goToMobileColumn(1)}
                className="inline-flex items-center gap-0.5 text-xs font-medium text-slate-500 disabled:opacity-30 py-2 px-2 -mr-2"
              >
                {mobileColIndex < COLUMNS.length - 1 ? COLUMNS[mobileColIndex + 1].shortLabel : ''}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Tablet hint — horizontal scroll */}
        {!isMobile && (
          <p className="hidden md:flex lg:hidden text-[11px] text-slate-400 mb-2 px-1 items-center gap-1">
            <ChevronLeft className="w-3 h-3" />
            Swipe sideways for columns
            <ChevronRight className="w-3 h-3" />
          </p>
        )}

        <div
          ref={scrollRef}
          className={`flex gap-3 md:gap-4 pb-4 -mx-1 px-1 ${
            isMobile ? '' : 'overflow-x-auto overscroll-x-contain snap-x snap-mandatory lg:snap-none scroll-smooth'
          }`}
          style={isMobile ? undefined : { WebkitOverflowScrolling: 'touch' }}
        >
          {visibleColumns.map((col) => (
            <KanbanColumn
              key={col.id}
              column={col}
              tasks={tasksByStatus[col.id]}
              me={me}
              isMobile={isMobile}
              isOver={overColumn === col.id && activeId !== null}
              onEdit={onEdit}
              onDelete={onDelete}
              onNavigate={onNavigate}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      </div>

      <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1)' }}>
        {activeTask && !isMobile ? (
          <KanbanCard
            task={activeTask}
            me={me}
            isDragging
            isMobile={false}
            onEdit={() => {}}
            onDelete={() => {}}
            onNavigate={() => {}}
            onStatusChange={() => {}}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

// Memoized: only re-renders when its column's tasks, drag state, or callbacks change
const KanbanColumn = memo(function KanbanColumn({
  column,
  tasks,
  me,
  isMobile,
  isOver,
  onEdit,
  onDelete,
  onNavigate,
  onStatusChange,
}: {
  column: (typeof COLUMNS)[number];
  tasks: Task[];
  me: User | null | undefined;
  isMobile: boolean;
  isOver: boolean;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onNavigate: (task: Task) => void;
  onStatusChange: (task: Task, status: TaskStatus) => void;
}) {
  const { setNodeRef, isOver: isOverDroppable } = useDroppable({ id: column.id });
  const Icon = column.icon;
  const highlighted = isOver || isOverDroppable;

  return (
    <div
      className={`flex flex-col flex-shrink-0 ${
        isMobile
          ? 'w-full'
          : 'w-[calc(100vw-2.5rem)] sm:w-72 md:w-[min(320px,32vw)] lg:w-80 snap-center'
      }`}
    >
      {!isMobile && (
        <div
          className={`flex items-center gap-2 px-3 py-2.5 rounded-t-xl border-t-[3px] ${column.accent} ${column.headerBg}`}
        >
          <Icon
            className={`w-4 h-4 ${
              column.id === 'In Progress'
                ? 'text-blue-500'
                : column.id === 'Completed'
                ? 'text-emerald-500'
                : 'text-slate-400'
            }`}
          />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {column.label}
          </h3>
          <span className="ml-auto text-xs font-medium tabular-nums px-2 py-0.5 rounded-full bg-white/80 dark:bg-white/[0.06] text-slate-500 dark:text-slate-400">
            {tasks.length}
          </span>
        </div>
      )}

      <div
        ref={setNodeRef}
        className={`flex-1 p-2 transition-all duration-200 ${
          isMobile ? 'min-h-0' : 'min-h-[420px] rounded-b-xl border border-t-0'
        } ${
          highlighted && !isMobile
            ? `ring-2 ${column.dropRing} bg-brand-50/30 dark:bg-brand-950/20 border-brand-300 dark:border-brand-700`
            : isMobile
            ? ''
            : 'bg-slate-50/60 dark:bg-white/[0.02] border-slate-200 dark:border-white/[0.06]'
        }`}
      >
        <div className={`space-y-2.5 ${isMobile ? '' : 'min-h-[80px]'}`}>
          {tasks.length === 0 ? (
            <div
              className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed text-xs transition-colors ${
                isMobile ? 'py-12 px-4' : 'h-24'
              } ${
                highlighted
                  ? 'border-brand-300 dark:border-brand-600 text-brand-500'
                  : 'border-slate-200 dark:border-white/[0.08] text-slate-400'
              }`}
            >
              {isMobile ? (
                <>
                  <Icon className="w-8 h-8 mb-2 opacity-40" />
                  <span>No {column.label.toLowerCase()} tasks</span>
                </>
              ) : (
                'Drop tasks here'
              )}
            </div>
          ) : (
            tasks.map((task) =>
              isMobile ? (
                <KanbanCard
                  key={task._id}
                  task={task}
                  me={me}
                  isMobile
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onNavigate={onNavigate}
                  onStatusChange={onStatusChange}
                />
              ) : (
                <DraggableKanbanCard
                  key={task._id}
                  task={task}
                  me={me}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onNavigate={onNavigate}
                  onStatusChange={onStatusChange}
                />
              ),
            )
          )}
        </div>
      </div>
    </div>
  );
});

// Memoized: only re-renders when this specific task's data changes
const DraggableKanbanCard = memo(function DraggableKanbanCard({
  task,
  me,
  onEdit,
  onDelete,
  onNavigate,
  onStatusChange,
}: {
  task: Task;
  me: User | null | undefined;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onNavigate: (task: Task) => void;
  onStatusChange: (task: Task, status: TaskStatus) => void;
}) {
  const draggable = canChangeTaskStatus(task, me);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task._id,
    disabled: !draggable,
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform), zIndex: isDragging ? 0 : undefined }
    : undefined;

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? 'opacity-30' : undefined}>
      <KanbanCard
        task={task}
        me={me}
        isMobile={false}
        dragHandleProps={draggable ? { ...attributes, ...listeners } : undefined}
        onEdit={onEdit}
        onDelete={onDelete}
        onNavigate={onNavigate}
        onStatusChange={onStatusChange}
      />
    </div>
  );
});

function MobileStatusActions({
  task,
  onStatusChange,
}: {
  task: Task;
  onStatusChange: (task: Task, status: TaskStatus) => void;
}) {
  const flow = STATUS_FLOW[task.status];

  return (
    <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-white/[0.06]">
      {flow.prev && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onStatusChange(task, flow.prev!);
          }}
          className="flex-1 min-h-[40px] px-2 py-2 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 active:scale-[0.98] transition-transform"
        >
          ← {flow.prevLabel}
        </button>
      )}
      {flow.next && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onStatusChange(task, flow.next!);
          }}
          className={`flex-1 min-h-[40px] px-2 py-2 rounded-lg text-xs font-semibold text-white active:scale-[0.98] transition-transform inline-flex items-center justify-center gap-1 ${
            flow.next === 'Completed'
              ? 'bg-emerald-600 active:bg-emerald-700'
              : 'bg-blue-600 active:bg-blue-700'
          }`}
        >
          {flow.nextLabel}
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// Memoized: only re-renders when task data or drag state changes
const KanbanCard = memo(function KanbanCard({
  task,
  me,
  isDragging,
  isMobile,
  dragHandleProps,
  onEdit,
  onDelete,
  onNavigate,
  onStatusChange,
}: {
  task: Task;
  me: User | null | undefined;
  isDragging?: boolean;
  isMobile: boolean;
  dragHandleProps?: Record<string, unknown>;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onNavigate: (task: Task) => void;
  onStatusChange: (task: Task, status: TaskStatus) => void;
}) {
  const editMode = getTaskEditMode(task, me);
  const draggable = canChangeTaskStatus(task, me);
  const overdue = task.status !== 'Completed' && isPast(new Date(task.dueDate));
  const projectName =
    typeof task.project === 'object' ? (task.project as Project).name : '';
  const assignee = task.assignedTo as User | undefined;

  return (
    <div
      className={`group/card bg-white dark:bg-[#111127] rounded-xl border shadow-sm transition-all duration-200 ${
        isDragging
          ? 'shadow-xl ring-2 ring-brand-400/60 rotate-[2deg] scale-[1.02] border-brand-300 dark:border-brand-500/50'
          : 'border-slate-200 dark:border-white/[0.07] hover:shadow-md hover:border-slate-300 dark:hover:border-white/[0.12] active:scale-[0.99]'
      } ${task.status === 'Completed' ? 'opacity-80' : ''}`}
    >
      <div className={isMobile ? 'p-4' : 'p-3.5'}>
        <div className="flex items-start gap-2">
          {draggable && dragHandleProps && !isMobile && (
            <button
              type="button"
              className="mt-0.5 p-1 -ml-1 text-slate-300 hover:text-slate-500 dark:hover:text-slate-400 cursor-grab active:cursor-grabbing touch-none flex-shrink-0 min-w-[32px] min-h-[32px] flex items-center justify-center"
              {...dragHandleProps}
              onClick={(e) => e.stopPropagation()}
              aria-label="Drag to move"
            >
              <GripVertical className="w-4 h-4" />
            </button>
          )}
          <div
            className="flex-1 min-w-0 cursor-pointer"
            onClick={() => !isDragging && onNavigate(task)}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <p
                className={`font-medium leading-snug ${isMobile ? 'text-base' : 'text-sm'} ${
                  task.status === 'Completed'
                    ? 'text-slate-500 dark:text-slate-400 line-through decoration-slate-400/60'
                    : 'text-slate-900 dark:text-white'
                }`}
              >
                {task.title}
              </p>
              <PriorityBadge priority={task.priority as TaskPriority} />
            </div>

            {projectName && (
              <p className="text-xs font-medium text-brand-600 dark:text-brand-400 mb-2 truncate">
                {projectName}
              </p>
            )}

            <div className="flex items-center justify-between gap-2">
              <span
                className={`flex items-center gap-1 text-xs font-medium ${
                  overdue ? 'text-red-500' : 'text-slate-400'
                }`}
              >
                <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                {format(new Date(task.dueDate), 'MMM d, yyyy')}
                {overdue && ' · Late'}
              </span>

              <div className="flex items-center gap-1">
                {editMode !== 'none' && !isDragging && (
                  <div
                    className={`flex gap-0.5 ${
                      isMobile ? '' : 'opacity-0 group-hover/card:opacity-100 transition-opacity'
                    }`}
                  >
                    <button
                      type="button"
                      className="p-2 text-slate-400 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/10 rounded-lg min-w-[36px] min-h-[36px] flex items-center justify-center transition-colors"
                      onClick={(e) => { e.stopPropagation(); onEdit(task); }}
                      title={editMode === 'delegate' ? 'Reassign' : 'Edit'}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {editMode === 'full' && (
                      <button
                        type="button"
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg min-w-[36px] min-h-[36px] flex items-center justify-center transition-colors"
                        onClick={(e) => { e.stopPropagation(); onDelete(task); }}
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
                {assignee && <Avatar name={assignee.name} size="sm" />}
              </div>
            </div>

            {isMobile && draggable && (
              <MobileStatusActions task={task} onStatusChange={onStatusChange} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
