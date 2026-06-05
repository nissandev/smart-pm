import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Project, ProjectDocument, ProjectStatus } from '../projects/project.schema';
import { Task, TaskDocument, TaskStatus, TaskPriority } from '../tasks/task.schema';
import { UserDocument, UserRole } from '../users/user.schema';
import { ActivityService } from '../activity/activity.service';

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
    @InjectModel(Task.name) private taskModel: Model<TaskDocument>,
    private activityService: ActivityService,
  ) {}

  async getSummary(user: UserDocument) {
    const projectQuery = this.buildProjectQuery(user);
    const projects = await this.projectModel.find(projectQuery).lean();
    const projectIds = projects.map((p) => p._id);

    const taskQuery = this.buildTaskQuery(user, projectIds);
    const tasks = await this.taskModel
      .find(taskQuery)
      .populate('assignedTo', 'name')
      .lean();

    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // KPI stats
    const taskStats = {
      total: tasks.length,
      completed: tasks.filter((t) => t.status === TaskStatus.COMPLETED).length,
      inProgress: tasks.filter((t) => t.status === TaskStatus.IN_PROGRESS).length,
      todo: tasks.filter((t) => t.status === TaskStatus.TODO).length,
      pending: tasks.filter((t) => t.status !== TaskStatus.COMPLETED).length,
      overdue: tasks.filter(
        (t) => t.status !== TaskStatus.COMPLETED && new Date(t.dueDate) < now,
      ).length,
    };

    const projectStats = {
      total: projects.length,
      active: projects.filter((p) => p.status === ProjectStatus.ACTIVE).length,
      completed: projects.filter((p) => p.status === ProjectStatus.COMPLETED).length,
      onHold: projects.filter((p) => p.status === ProjectStatus.ON_HOLD).length,
    };

    // Tasks by priority (bar chart)
    const tasksByPriority = [
      { priority: 'High', count: tasks.filter((t) => t.priority === TaskPriority.HIGH).length },
      { priority: 'Medium', count: tasks.filter((t) => t.priority === TaskPriority.MEDIUM).length },
      { priority: 'Low', count: tasks.filter((t) => t.priority === TaskPriority.LOW).length },
    ];

    // Task status distribution (donut chart)
    const taskStatusDistribution = [
      { status: 'Todo', count: taskStats.todo },
      { status: 'In Progress', count: taskStats.inProgress },
      { status: 'Completed', count: taskStats.completed },
    ];

    // Project progress trend (PRD §08): tasks completed per week, last 8 weeks.
    // Uses task.updatedAt as the proxy for "completion time" (last update on a Completed task).
    const completionTrend = this.buildCompletionTrend(tasks, 8);

    // Project progress summary
    // PRD §08 deadline indicator: green > 7 days, amber 2–7 days, red < 2 days OR overdue
    const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    const projectSummary = projects.map((p) => {
      const projectTasks = tasks.filter((t) => t.project.toString() === p._id.toString());
      const completedCount = projectTasks.filter((t) => t.status === TaskStatus.COMPLETED).length;
      const completionPct = projectTasks.length > 0
        ? Math.round((completedCount / projectTasks.length) * 100)
        : 0;
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
        totalTasks: projectTasks.length,
        completedTasks: completedCount,
        pendingTasks: projectTasks.filter((t) => t.status !== TaskStatus.COMPLETED).length,
        completionPct,
        deadlineColor,
      };
    });

    // Upcoming deadlines (next 7 days — tasks not completed)
    const upcomingDeadlines = tasks
      .filter((t) => {
        const due = new Date(t.dueDate);
        return t.status !== TaskStatus.COMPLETED && due >= now && due <= sevenDaysFromNow;
      })
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 10);

    // High-priority tasks (not completed)
    const highPriorityTasks = tasks
      .filter((t) => t.priority === TaskPriority.HIGH && t.status !== TaskStatus.COMPLETED)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 10);

    // Member workload summary
    const memberWorkload = this.buildMemberWorkload(tasks);

    // Team productivity (completed tasks per member)
    const teamProductivity = memberWorkload
      .map((m) => ({ name: m.name, completed: m.completed }))
      .filter((m) => m.completed > 0)
      .sort((a, b) => b.completed - a.completed);

    // Recent activity (role-scoped per PRD §02 permission matrix)
    let recentActivity: any[] = [];
    if (user.role === UserRole.ADMIN) {
      recentActivity = await this.activityService.findRecent(10);
    } else if (user.role === UserRole.PROJECT_MANAGER) {
      recentActivity = await this.activityService.findRecent(10, { projectIds: projectIds });
    }
    // Members do not see activity log per PRD permission matrix.

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

  // Bucket completed tasks into the last `weeks` ISO weeks based on updatedAt.
  // Returns: [{ label: 'Apr 22', completed: 3, created: 5 }, …]
  private buildCompletionTrend(tasks: any[], weeks: number) {
    const buckets: { start: Date; end: Date; label: string; completed: number; created: number }[] = [];
    const now = new Date();
    // Normalise to start-of-day (UTC) to make bucketing deterministic
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

  private buildProjectQuery(user: UserDocument) {
    if (user.role === UserRole.ADMIN) return {};
    if (user.role === UserRole.PROJECT_MANAGER) return { createdBy: (user as any)._id };
    return { members: (user as any)._id };
  }

  private buildTaskQuery(user: UserDocument, projectIds: any[]) {
    if (user.role === UserRole.MEMBER) return { assignedTo: (user as any)._id };
    return { project: { $in: projectIds } };
  }

  private buildMemberWorkload(tasks: any[]) {
    const map = new Map<string, { name: string; total: number; completed: number; inProgress: number; todo: number }>();
    for (const t of tasks) {
      if (!t.assignedTo) continue;
      const id = t.assignedTo._id?.toString() ?? t.assignedTo.toString();
      const name = t.assignedTo.name ?? 'Unknown';
      if (!map.has(id)) {
        map.set(id, { name, total: 0, completed: 0, inProgress: 0, todo: 0 });
      }
      const entry = map.get(id)!;
      entry.total++;
      if (t.status === TaskStatus.COMPLETED) entry.completed++;
      else if (t.status === TaskStatus.IN_PROGRESS) entry.inProgress++;
      else entry.todo++;
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }
}
