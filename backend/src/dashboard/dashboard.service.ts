import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Project, ProjectDocument, ProjectStatus } from '../projects/project.schema';
import { Task, TaskDocument, TaskStatus, TaskPriority } from '../tasks/task.schema';
import { UserDocument, UserRole } from '../users/user.schema';
import { ActivityService } from '../activity/activity.service';
import { buildProjectScopeFilter, buildTaskScopeFilter } from '../common/project-scope.util';

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
    @InjectModel(Task.name) private taskModel: Model<TaskDocument>,
    private activityService: ActivityService,
  ) {}

  async getSummary(user: UserDocument) {
    const isMember = user.role === UserRole.MEMBER;
    const canViewTeamInsights =
      user.role === UserRole.ADMIN || user.role === UserRole.PROJECT_MANAGER;

    const projectQuery = buildProjectScopeFilter(user);
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

    const projectRows = await this.projectModel
      .find(projectQuery)
      .select('_id name status deadline')
      .lean()
      .exec();
    const projectIds = projectRows.map((p) => p._id as Types.ObjectId);
    const taskFilter = buildTaskScopeFilter(user, projectIds);

    const workloadPromise = canViewTeamInsights
      ? this.taskModel.aggregate([
          { $match: { ...taskFilter, assignedTo: { $exists: true, $ne: null } } },
          {
            $group: {
              _id: '$assignedTo',
              total: { $sum: 1 },
              completed: {
                $sum: { $cond: [{ $eq: ['$status', TaskStatus.COMPLETED] }, 1, 0] },
              },
              inProgress: {
                $sum: { $cond: [{ $eq: ['$status', TaskStatus.IN_PROGRESS] }, 1, 0] },
              },
              todo: {
                $sum: { $cond: [{ $eq: ['$status', TaskStatus.TODO] }, 1, 0] },
              },
            },
          },
          {
            $lookup: {
              from: 'users',
              localField: '_id',
              foreignField: '_id',
              as: 'user',
            },
          },
          { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
          { $sort: { total: -1 } },
        ])
      : Promise.resolve([]);

    const [
      statusCounts,
      priorityCounts,
      overdueCount,
      perProjectCounts,
      completionTrend,
      upcomingDeadlines,
      highPriorityTasks,
      workloadRows,
    ] = await Promise.all([
      this.taskModel.aggregate([
        { $match: taskFilter },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      this.taskModel.aggregate([
        { $match: taskFilter },
        { $group: { _id: '$priority', count: { $sum: 1 } } },
      ]),
      this.taskModel.countDocuments({
        ...taskFilter,
        status: { $ne: TaskStatus.COMPLETED },
        dueDate: { $lt: now },
      }),
      this.taskModel.aggregate([
        { $match: taskFilter },
        {
          $group: {
            _id: '$project',
            total: { $sum: 1 },
            completed: {
              $sum: { $cond: [{ $eq: ['$status', TaskStatus.COMPLETED] }, 1, 0] },
            },
            pending: {
              $sum: { $cond: [{ $ne: ['$status', TaskStatus.COMPLETED] }, 1, 0] },
            },
          },
        },
      ]),
      this.buildCompletionTrendFromTasks(taskFilter, 8),
      this.taskModel
        .find({
          ...taskFilter,
          status: { $ne: TaskStatus.COMPLETED },
          dueDate: { $gte: now, $lte: sevenDaysFromNow },
        })
        .populate('assignedTo', 'name')
        .sort({ dueDate: 1 })
        .limit(10)
        .lean()
        .exec(),
      this.taskModel
        .find({
          ...taskFilter,
          priority: TaskPriority.HIGH,
          status: { $ne: TaskStatus.COMPLETED },
        })
        .populate('assignedTo', 'name')
        .sort({ dueDate: 1 })
        .limit(10)
        .lean()
        .exec(),
      workloadPromise,
    ]);

    const statusMap = new Map(statusCounts.map((r) => [r._id, r.count]));
    const todo = statusMap.get(TaskStatus.TODO) ?? 0;
    const inProgress = statusMap.get(TaskStatus.IN_PROGRESS) ?? 0;
    const completed = statusMap.get(TaskStatus.COMPLETED) ?? 0;
    const totalTasks = todo + inProgress + completed;

    const taskStats = {
      total: totalTasks,
      completed,
      inProgress,
      todo,
      pending: totalTasks - completed,
      overdue: overdueCount,
    };

    const projectStats = {
      total: projectRows.length,
      active: projectRows.filter((p) => p.status === ProjectStatus.ACTIVE).length,
      completed: projectRows.filter((p) => p.status === ProjectStatus.COMPLETED).length,
      onHold: projectRows.filter((p) => p.status === ProjectStatus.ON_HOLD).length,
    };

    const priorityMap = new Map(priorityCounts.map((r) => [r._id, r.count]));
    const tasksByPriority = [
      { priority: 'High', count: priorityMap.get(TaskPriority.HIGH) ?? 0 },
      { priority: 'Medium', count: priorityMap.get(TaskPriority.MEDIUM) ?? 0 },
      { priority: 'Low', count: priorityMap.get(TaskPriority.LOW) ?? 0 },
    ];

    const taskStatusDistribution = [
      { status: 'Todo', count: todo },
      { status: 'In Progress', count: inProgress },
      { status: 'Completed', count: completed },
    ];

    const countsByProject = new Map(
      perProjectCounts.map((r) => [r._id.toString(), r]),
    );

    const projectSummary = projectRows
      .map((p) => {
        const counts = countsByProject.get(p._id.toString()) ?? {
          total: 0,
          completed: 0,
          pending: 0,
        };
        const completionPct =
          counts.total > 0 ? Math.round((counts.completed / counts.total) * 100) : 0;
        const deadlineDate = new Date(p.deadline);
        const isCompleted = p.status === ProjectStatus.COMPLETED;
        const isOverdue = !isCompleted && deadlineDate < now;
        const isCritical = !isCompleted && deadlineDate <= twoDaysFromNow;
        const isWarning = !isCompleted && deadlineDate <= sevenDaysFromNow;
        const deadlineColor: 'red' | 'yellow' | 'green' =
          isOverdue || isCritical ? 'red' : isWarning ? 'yellow' : 'green';
        return {
          _id: p._id,
          name: p.name,
          status: p.status,
          deadline: p.deadline,
          totalTasks: counts.total,
          completedTasks: counts.completed,
          pendingTasks: counts.pending,
          completionPct,
          deadlineColor,
        };
      })
      .filter((p) => !isMember || p.totalTasks > 0);

    const memberWorkload = canViewTeamInsights
      ? workloadRows.map((r) => ({
          name: r.user?.name ?? 'Unknown',
          total: r.total,
          completed: r.completed,
          inProgress: r.inProgress,
          todo: r.todo,
        }))
      : [];

    const teamProductivity = canViewTeamInsights
      ? memberWorkload
          .map((m) => ({ name: m.name, completed: m.completed }))
          .filter((m) => m.completed > 0)
          .sort((a, b) => b.completed - a.completed)
      : [];

    let recentActivity: unknown[] = [];
    if (user.role === UserRole.ADMIN) {
      recentActivity = await this.activityService.findRecent(10);
    } else if (user.role === UserRole.PROJECT_MANAGER) {
      recentActivity = await this.activityService.findRecent(10, { projectIds });
    }

    return {
      projects: projectStats,
      tasks: taskStats,
      tasksByPriority,
      taskStatusDistribution,
      completionTrend,
      projectSummary,
      upcomingDeadlines,
      highPriorityTasks,
      memberWorkload,
      teamProductivity,
      recentActivity,
    };
  }

  private async buildCompletionTrendFromTasks(
    taskFilter: Record<string, unknown>,
    weeks: number,
  ) {
    const buckets = this.makeWeekBuckets(weeks);
    const earliest = buckets[0].start;
    const scopedFilter = {
      $and: [
        taskFilter,
        {
          $or: [
            { createdAt: { $gte: earliest } },
            { status: TaskStatus.COMPLETED, updatedAt: { $gte: earliest } },
          ],
        },
      ],
    };
    const tasks = await this.taskModel
      .find(scopedFilter)
      .select('status createdAt updatedAt')
      .lean()
      .exec();
    return this.buildCompletionTrend(tasks, weeks);
  }

  private makeWeekBuckets(weeks: number) {
    const buckets: { start: Date; end: Date; label: string }[] = [];
    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    for (let i = weeks - 1; i >= 0; i--) {
      const end = new Date(todayUTC);
      end.setUTCDate(end.getUTCDate() - i * 7);
      const start = new Date(end);
      start.setUTCDate(start.getUTCDate() - 6);
      const label = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
      buckets.push({ start, end, label });
    }
    return buckets;
  }

  private buildCompletionTrend(tasks: Array<{ status: TaskStatus; createdAt?: Date; updatedAt?: Date }>, weeks: number) {
    const buckets: { start: Date; end: Date; label: string; completed: number; created: number }[] = [];
    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    for (let i = weeks - 1; i >= 0; i--) {
      const end = new Date(todayUTC);
      end.setUTCDate(end.getUTCDate() - i * 7);
      const start = new Date(end);
      start.setUTCDate(start.getUTCDate() - 6);
      const label = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
      buckets.push({ start, end, label, completed: 0, created: 0 });
    }
    for (const t of tasks) {
      const created = t.createdAt ? new Date(t.createdAt) : null;
      const updated = t.updatedAt ? new Date(t.updatedAt) : null;
      for (const b of buckets) {
        const startMs = b.start.getTime();
        const endMs = b.end.getTime() + 86_400_000 - 1;
        if (created && created.getTime() >= startMs && created.getTime() <= endMs) b.created++;
        if (
          t.status === TaskStatus.COMPLETED &&
          updated &&
          updated.getTime() >= startMs &&
          updated.getTime() <= endMs
        ) {
          b.completed++;
        }
      }
    }
    return buckets.map((b) => ({ label: b.label, completed: b.completed, created: b.created }));
  }

  async getMyWork(
    user: UserDocument,
    filters: { project?: string; assignee?: string } = {},
  ) {
    const projectQuery = buildProjectScopeFilter(user);
    let projectFilter: Record<string, unknown> = projectQuery;
    if (filters.project) {
      projectFilter = { $and: [projectQuery, { _id: new Types.ObjectId(filters.project) }] };
    }

    const projectRows = await this.projectModel.find(projectFilter).select('name').lean().exec();
    const projectIds = projectRows.map((p) => p._id as Types.ObjectId);
    let taskQuery: Record<string, unknown> = buildTaskScopeFilter(user, projectIds);
    if (filters.assignee) {
      taskQuery = {
        $and: [taskQuery, { assignedTo: new Types.ObjectId(filters.assignee) }],
      };
    }

    const now = new Date();
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    const MY_WORK_LIMIT = 50;

    const [overdue, dueSoon, stagnant, assigneeRows] = await Promise.all([
      this.taskModel
        .find({ ...taskQuery, status: { $ne: TaskStatus.COMPLETED }, dueDate: { $lt: now } })
        .populate('project', 'name')
        .populate('assignedTo', 'name email avatar')
        .sort({ dueDate: 1 })
        .limit(MY_WORK_LIMIT)
        .lean()
        .exec(),
      this.taskModel
        .find({
          ...taskQuery,
          status: { $ne: TaskStatus.COMPLETED },
          dueDate: { $gte: now, $lte: in48h },
        })
        .populate('project', 'name')
        .populate('assignedTo', 'name email avatar')
        .sort({ dueDate: 1 })
        .limit(MY_WORK_LIMIT)
        .lean()
        .exec(),
      this.taskModel
        .find({
          ...taskQuery,
          status: TaskStatus.TODO,
          dueDate: { $lt: now },
        })
        .populate('project', 'name')
        .populate('assignedTo', 'name email avatar')
        .sort({ dueDate: 1 })
        .limit(MY_WORK_LIMIT)
        .lean()
        .exec(),
      this.taskModel
        .aggregate([
          { $match: { ...taskQuery, assignedTo: { $exists: true, $ne: null } } },
          { $group: { _id: '$assignedTo' } },
          {
            $lookup: {
              from: 'users',
              localField: '_id',
              foreignField: '_id',
              as: 'user',
            },
          },
          { $unwind: '$user' },
          { $project: { _id: 1, name: '$user.name' } },
          { $sort: { name: 1 } },
        ]),
    ]);

    return {
      counts: {
        overdue: overdue.length,
        dueSoon: dueSoon.length,
        stagnant: stagnant.length,
      },
      overdue,
      dueSoon,
      stagnant,
      filters: {
        projects: projectRows.map((p) => ({ _id: p._id, name: p.name })),
        assignees: assigneeRows.map((r) => ({ _id: r._id, name: r.name })),
      },
    };
  }
}
