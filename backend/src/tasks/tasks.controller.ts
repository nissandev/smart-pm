import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, UseGuards, Query, UploadedFile, UseInterceptors,
  BadRequestException, Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiConsumes, ApiBody, ApiOperation } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomBytes } from 'crypto';
import { mkdirSync, readFileSync, unlinkSync } from 'fs';
import type { Response } from 'express';
import { createReadStream } from 'fs';
import { TasksService } from './tasks.service';
import { assertBufferMatchesMime } from '../common/file-type.util';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { AddCommentDto, UpdateCommentDto } from './dto/comment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserDocument, UserRole } from '../users/user.schema';

const UPLOADS_DIR = join(process.cwd(), 'uploads', 'tasks');
mkdirSync(UPLOADS_DIR, { recursive: true });

const ALLOWED_MIME = [
  'image/png', 'image/jpeg', 'image/gif', 'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv',
];

@ApiTags('Tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  create(@Body() dto: CreateTaskDto, @CurrentUser() user: UserDocument) {
    return this.tasksService.create(dto, user);
  }

  @Get()
  findAll(
    @CurrentUser() user: UserDocument,
    @Query('project') project?: string,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('assignedTo') assignedTo?: string,
    @Query('createdBy') createdBy?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.tasksService.findAll(
      user,
      { project, status, priority, assignedTo, createdBy },
      page,
      limit,
    );
  }

  @Get('stats')
  getStats(@CurrentUser() user: UserDocument) {
    return this.tasksService.getStats(user);
  }

  @Get('import/template')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.PROJECT_MANAGER)
  @ApiOperation({ summary: 'Download CSV template for bulk task import' })
  async downloadImportTemplate(@CurrentUser() user: UserDocument, @Res() res: Response) {
    const csv = await this.tasksService.buildImportTemplate(user);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="smartpm-task-import-template.csv"');
    res.send(csv);
  }

  @Post('import/bulk')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.PROJECT_MANAGER)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Bulk import tasks from CSV' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 2 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ok =
          file.mimetype === 'text/csv' ||
          file.mimetype === 'application/vnd.ms-excel' ||
          file.mimetype === 'text/plain' ||
          file.originalname.toLowerCase().endsWith('.csv');
        if (!ok) return cb(new BadRequestException('Please upload a .csv file'), false);
        cb(null, true);
      },
    }),
  )
  bulkImport(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: UserDocument) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.tasksService.bulkImportFromCsv(file.buffer, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: UserDocument) {
    return this.tasksService.findById(id, user);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() user: UserDocument,
  ) {
    return this.tasksService.update(id, dto, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: UserDocument) {
    return this.tasksService.remove(id, user);
  }

  @Post(':id/comments')
  addComment(
    @Param('id') id: string,
    @Body() dto: AddCommentDto,
    @CurrentUser() user: UserDocument,
  ) {
    return this.tasksService.addComment(id, dto.text, user);
  }

  @Patch(':id/comments/:commentId')
  updateComment(
    @Param('id') id: string,
    @Param('commentId') commentId: string,
    @Body() dto: UpdateCommentDto,
    @CurrentUser() user: UserDocument,
  ) {
    return this.tasksService.updateComment(id, commentId, dto.text, user);
  }

  @Delete(':id/comments/:commentId')
  deleteComment(
    @Param('id') id: string,
    @Param('commentId') commentId: string,
    @CurrentUser() user: UserDocument,
  ) {
    return this.tasksService.deleteComment(id, commentId, user);
  }

  // ── File attachments (PRD §10) ──────────────────────────────────
  @Post(':id/attachments')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: UPLOADS_DIR,
        filename: (_req, file, cb) => {
          const safe = file.originalname.replace(/[^\w.\-]+/g, '_').slice(0, 80);
          const stamp = Date.now().toString(36);
          const rand = randomBytes(4).toString('hex');
          cb(null, `${stamp}-${rand}-${safe}${extname(safe) ? '' : ''}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIME.includes(file.mimetype)) {
          return cb(new BadRequestException('File type not allowed'), false);
        }
        cb(null, true);
      },
    }),
  )
  uploadAttachment(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: UserDocument,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');

    const absolutePath = join(UPLOADS_DIR, file.filename);
    try {
      const buffer = readFileSync(absolutePath);
      assertBufferMatchesMime(buffer, file.mimetype);
    } catch (err) {
      try {
        unlinkSync(absolutePath);
      } catch {
        /* ignore cleanup errors */
      }
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException('Uploaded file could not be validated');
    }

    const url = `/uploads/tasks/${file.filename}`;
    return this.tasksService.addAttachment(id, {
      url,
      name: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
    }, user);
  }

  @Get(':id/attachments/:idx/download')
  @ApiOperation({ summary: 'Download task attachment (authenticated)' })
  async downloadAttachment(
    @Param('id') id: string,
    @Param('idx') idx: string,
    @CurrentUser() user: UserDocument,
    @Res() res: Response,
  ) {
    const file = await this.tasksService.getAttachmentForDownload(id, +idx, user);
    res.setHeader('Content-Type', file.mimeType ?? 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.name)}"`);
    createReadStream(file.absolutePath).pipe(res);
  }

  @Delete(':id/attachments/:idx')
  deleteAttachment(
    @Param('id') id: string,
    @Param('idx') idx: string,
    @CurrentUser() user: UserDocument,
  ) {
    return this.tasksService.removeAttachment(id, +idx, user);
  }
}
