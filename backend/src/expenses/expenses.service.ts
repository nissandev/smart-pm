import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, ClientSession } from 'mongoose';
import { Expense, ExpenseDocument, ExpenseCategory } from './expense.schema';
import { CreateExpenseDto, UpdateExpenseDto } from './dto/create-expense.dto';
import { Project, ProjectDocument } from '../projects/project.schema';
import { UserRole, UserDocument } from '../users/user.schema';
import { assertProjectAccess, assertProjectLeadOrAdmin } from '../common/project-access.util';
import { buildProjectScopeFilter } from '../common/project-scope.util';
import { ActivityService } from '../activity/activity.service';
import { ActionType } from '../activity/activity.schema';

export interface ExpenseSummary {
  total: number;
  currency: string;
  count: number;
  byCategory: { category: ExpenseCategory; total: number }[];
}

@Injectable()
export class ExpensesService {
  constructor(
    @InjectModel(Expense.name) private expenseModel: Model<ExpenseDocument>,
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
    private activityService: ActivityService,
  ) {}

  async findByProject(projectId: string, user: UserDocument): Promise<ExpenseDocument[]> {
    await this.assertProjectAccess(projectId, user);
    return this.expenseModel
      .find({ project: projectId })
      .populate('createdBy', 'name email role')
      .sort({ date: -1, createdAt: -1 })
      .exec();
  }

  async getSummary(projectId: string, user: UserDocument): Promise<ExpenseSummary> {
    await this.assertProjectAccess(projectId, user);
    const pid = new Types.ObjectId(projectId);
    const [totalsRow, categoryRows] = await Promise.all([
      this.expenseModel.aggregate([
        { $match: { project: pid } },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' },
            count: { $sum: 1 },
            currency: { $first: '$currency' },
          },
        },
      ]),
      this.expenseModel.aggregate([
        { $match: { project: pid } },
        { $group: { _id: '$category', total: { $sum: '$amount' } } },
        { $sort: { total: -1 } },
      ]),
    ]);

    const totals = totalsRow[0];
    const total = Math.round((totals?.total ?? 0) * 100) / 100;

    return {
      total,
      currency: totals?.currency ?? 'USD',
      count: totals?.count ?? 0,
      byCategory: categoryRows.map((row) => ({
        category: row._id as ExpenseCategory,
        total: Math.round(row.total * 100) / 100,
      })),
    };
  }

  /** Totals for all projects the user can access (for project list cards). */
  async getTotalsForUser(user: UserDocument): Promise<Record<string, number>> {
    const projectIds = await this.getAccessibleProjectIds(user);
    if (projectIds.length === 0) return {};

    const rows = await this.expenseModel.aggregate([
      { $match: { project: { $in: projectIds.map((id) => new Types.ObjectId(id)) } } },
      { $group: { _id: '$project', total: { $sum: '$amount' } } },
    ]);

    const map: Record<string, number> = {};
    for (const row of rows) {
      map[row._id.toString()] = Math.round(row.total * 100) / 100;
    }
    return map;
  }

  async create(
    projectId: string,
    dto: CreateExpenseDto,
    user: UserDocument,
  ): Promise<ExpenseDocument> {
    const project = await this.assertCanManage(projectId, user);
    const amount = Math.round(dto.amount * 100) / 100;
    if (amount < 0.01) throw new BadRequestException('Amount must be at least 0.01');

    const expense = await this.expenseModel.create({
      project: project._id,
      category: dto.category,
      description: dto.description.trim(),
      amount,
      currency: (dto.currency ?? 'USD').toUpperCase(),
      date: new Date(dto.date),
      notes: dto.notes?.trim() || undefined,
      createdBy: (user as any)._id,
    });

    const populated = await expense.populate('createdBy', 'name email role');

    await this.activityService.log({
      actor: (user as any)._id,
      actionType: ActionType.EXPENSE_ADDED,
      entityType: 'expense',
      entityId: expense._id,
      description: `Expense "${dto.description}" ($${amount.toFixed(2)}) added to "${project.name}"`,
      project: project._id,
    });

    return populated;
  }

  async update(
    projectId: string,
    expenseId: string,
    dto: UpdateExpenseDto,
    user: UserDocument,
  ): Promise<ExpenseDocument> {
    const project = await this.assertCanManage(projectId, user);
    const expense = await this.expenseModel.findOne({ _id: expenseId, project: projectId });
    if (!expense) throw new NotFoundException('Expense not found');

    if (dto.amount != null) {
      const amount = Math.round(dto.amount * 100) / 100;
      if (amount < 0.01) throw new BadRequestException('Amount must be at least 0.01');
      expense.amount = amount;
    }
    if (dto.category != null) expense.category = dto.category;
    if (dto.description != null) expense.description = dto.description.trim();
    if (dto.currency != null) expense.currency = dto.currency.toUpperCase();
    if (dto.date != null) expense.date = new Date(dto.date);
    if (dto.notes !== undefined) expense.notes = dto.notes?.trim() || undefined;

    await expense.save();
    const populated = await expense.populate('createdBy', 'name email role');

    await this.activityService.log({
      actor: (user as any)._id,
      actionType: ActionType.EXPENSE_UPDATED,
      entityType: 'expense',
      entityId: expense._id,
      description: `Expense "${expense.description}" updated on "${project.name}"`,
      project: project._id,
    });

    return populated;
  }

  async remove(projectId: string, expenseId: string, user: UserDocument): Promise<void> {
    const project = await this.assertCanManage(projectId, user);
    const expense = await this.expenseModel.findOne({ _id: expenseId, project: projectId });
    if (!expense) throw new NotFoundException('Expense not found');

    await this.activityService.log({
      actor: (user as any)._id,
      actionType: ActionType.EXPENSE_DELETED,
      entityType: 'expense',
      entityId: expense._id,
      description: `Expense "${expense.description}" ($${expense.amount.toFixed(2)}) removed from "${project.name}"`,
      project: project._id,
    });

    await expense.deleteOne();
  }

  async deleteByProject(projectId: Types.ObjectId, session?: ClientSession): Promise<number> {
    const result = await this.expenseModel.deleteMany({ project: projectId }, { session });
    return result.deletedCount ?? 0;
  }

  private async getAccessibleProjectIds(user: UserDocument): Promise<string[]> {
    const query = buildProjectScopeFilter(user);
    const projects = await this.projectModel.find(query).select('_id').lean().exec();
    return projects.map((p) => p._id.toString());
  }

  private async assertProjectAccess(projectId: string, user: UserDocument): Promise<ProjectDocument> {
    const project = await this.projectModel.findById(projectId);
    if (!project) throw new NotFoundException('Project not found');
    this.checkAccess(project, user);
    return project;
  }

  private async assertCanManage(projectId: string, user: UserDocument): Promise<ProjectDocument> {
    const project = await this.projectModel.findById(projectId);
    if (!project) throw new NotFoundException('Project not found');
    this.checkLeadOrAdmin(project, user);
    return project;
  }

  private checkAccess(project: ProjectDocument, user: UserDocument) {
    assertProjectAccess(project, user);
  }

  private checkLeadOrAdmin(project: ProjectDocument, user: UserDocument) {
    assertProjectLeadOrAdmin(project, user);
  }
}
