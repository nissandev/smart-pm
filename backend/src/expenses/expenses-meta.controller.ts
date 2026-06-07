import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { ExpensesService } from './expenses.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserDocument } from '../users/user.schema';

/** Totals endpoint lives outside /projects/:id to avoid route param conflicts. */
@ApiTags('Project Expenses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('expenses')
export class ExpensesMetaController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get('totals-by-project')
  @ApiOperation({ summary: 'Total spend per project (for project list cards)' })
  getTotalsByProject(@CurrentUser() user: UserDocument) {
    return this.expensesService.getTotalsForUser(user);
  }
}
