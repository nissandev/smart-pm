import { Controller, Get, Query, UseGuards, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserDocument } from '../users/user.schema';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  async getSummary(@CurrentUser() user: UserDocument, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'private, max-age=60');
    return this.dashboardService.getSummary(user);
  }

  @Get('my-work')
  async getMyWork(
    @CurrentUser() user: UserDocument,
    @Res({ passthrough: true }) res: Response,
    @Query('project') project?: string,
    @Query('assignee') assignee?: string,
  ) {
    res.setHeader('Cache-Control', 'private, max-age=30');
    return this.dashboardService.getMyWork(user, { project, assignee });
  }
}
