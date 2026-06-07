import { Controller, Get, Query, UseGuards, ForbiddenException, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ActivityService } from './activity.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserRole, UserDocument } from '../users/user.schema';
import { ProjectsService } from '../projects/projects.service';

@ApiTags('Activity')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('activity')
export class ActivityController {
  constructor(
    private readonly activityService: ActivityService,
    private readonly projectsService: ProjectsService,
  ) {}

  // PRD §02 — view activity log: Admin = all, PM = own projects, Member = denied
  private async resolveScope(user: UserDocument, projectFilter?: string) {
    if (user.role === UserRole.ADMIN) {
      return projectFilter ? { projectId: projectFilter } : {};
    }
    // Project Manager: scope to their own projects (override single-project filter
    // only if it's not one of their projects, otherwise honor it).
    const ownedIds = await this.projectsService.findAccessibleProjectIds(user);
    if (projectFilter) {
      const allowed = ownedIds.some((id: any) => id.toString() === projectFilter);
      if (!allowed) throw new ForbiddenException('Access denied');
      return { projectId: projectFilter };
    }
    return { projectIds: ownedIds };
  }

  @Get()
  async findAll(
    @Request() req: any,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('project') project?: string,
  ) {
    const user = req.user;
    if (user.role === UserRole.MEMBER) throw new ForbiddenException('Access denied');
    const scope = await this.resolveScope(user, project);
    return this.activityService.findPaginated(+page, +limit, scope);
  }

  @Get('recent')
  async recent(
    @Request() req: any,
    @Query('limit') limit = '10',
    @Query('project') project?: string,
  ) {
    const user = req.user;
    if (user.role === UserRole.MEMBER) throw new ForbiddenException('Access denied');
    const scope = await this.resolveScope(user, project);
    return this.activityService.findRecent(+limit, scope);
  }
}
