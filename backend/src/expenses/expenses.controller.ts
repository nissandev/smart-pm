import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto, UpdateExpenseDto } from './dto/create-expense.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserDocument } from '../users/user.schema';

@ApiTags('Project Expenses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  @ApiOperation({ summary: 'List expenses for a project' })
  findAll(@Param('projectId') projectId: string, @CurrentUser() user: UserDocument) {
    return this.expensesService.findByProject(projectId, user);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Expense totals and breakdown by category' })
  getSummary(@Param('projectId') projectId: string, @CurrentUser() user: UserDocument) {
    return this.expensesService.getSummary(projectId, user);
  }

  @Post()
  @ApiOperation({ summary: 'Add an expense (admin or project lead)' })
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateExpenseDto,
    @CurrentUser() user: UserDocument,
  ) {
    return this.expensesService.create(projectId, dto, user);
  }

  @Patch(':expenseId')
  @ApiOperation({ summary: 'Update an expense' })
  update(
    @Param('projectId') projectId: string,
    @Param('expenseId') expenseId: string,
    @Body() dto: UpdateExpenseDto,
    @CurrentUser() user: UserDocument,
  ) {
    return this.expensesService.update(projectId, expenseId, dto, user);
  }

  @Delete(':expenseId')
  @ApiOperation({ summary: 'Delete an expense' })
  remove(
    @Param('projectId') projectId: string,
    @Param('expenseId') expenseId: string,
    @CurrentUser() user: UserDocument,
  ) {
    return this.expensesService.remove(projectId, expenseId, user);
  }
}
