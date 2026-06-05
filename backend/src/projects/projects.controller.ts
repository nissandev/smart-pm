import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, UseGuards, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiQuery } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserDocument } from '../users/user.schema';

@ApiTags('Projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  create(@Body() dto: CreateProjectDto, @CurrentUser() user: UserDocument) {
    return this.projectsService.create(dto, user);
  }

  @Get()
  findAll(@CurrentUser() user: UserDocument) {
    return this.projectsService.findAll(user);
  }

  @Get('stats')
  getStats(@CurrentUser() user: UserDocument) {
    return this.projectsService.getStats(user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: UserDocument) {
    return this.projectsService.findById(id, user);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser() user: UserDocument,
  ) {
    return this.projectsService.update(id, dto, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: UserDocument) {
    return this.projectsService.remove(id, user);
  }

  @Post(':id/members/:memberId')
  addMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() dto: AddMemberDto,
    @CurrentUser() user: UserDocument,
  ) {
    return this.projectsService.addMember(id, memberId, user, dto.makeOwner);
  }

  @Delete(':id/members/:memberId')
  removeMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: UserDocument,
  ) {
    return this.projectsService.removeMember(id, memberId, user);
  }
}
