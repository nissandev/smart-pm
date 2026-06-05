import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Activity, ActivityDocument, ActionType } from './activity.schema';

interface ActivityScope {
  // Restrict to a single project (used by project detail view)
  projectId?: string;
  // Restrict to a set of projects (used for PM scope: their own projects)
  projectIds?: (string | Types.ObjectId)[];
}

@Injectable()
export class ActivityService {
  constructor(@InjectModel(Activity.name) private activityModel: Model<ActivityDocument>) {}

  async log(data: {
    actor: string | Types.ObjectId;
    actionType: ActionType;
    entityType: string;
    entityId?: string | Types.ObjectId;
    description: string;
    project?: string | Types.ObjectId;
  }): Promise<ActivityDocument> {
    const activity = new this.activityModel(data);
    return activity.save();
  }

  private buildQuery(scope: ActivityScope): any {
    const q: any = {};
    if (scope.projectId) {
      q.project = new Types.ObjectId(scope.projectId);
    } else if (scope.projectIds) {
      q.project = { $in: scope.projectIds.map((id) => new Types.ObjectId(id.toString())) };
    }
    return q;
  }

  async findRecent(limit = 10, scope: ActivityScope = {}): Promise<ActivityDocument[]> {
    return this.activityModel
      .find(this.buildQuery(scope))
      .populate('actor', 'name email avatar')
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  async findPaginated(page = 1, limit = 20, scope: ActivityScope = {}) {
    const query = this.buildQuery(scope);
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.activityModel
        .find(query)
        .populate('actor', 'name email avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.activityModel.countDocuments(query),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }
}
