import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Expense, ExpenseSchema } from './expense.schema';
import { ExpensesService } from './expenses.service';
import { ExpensesController } from './expenses.controller';
import { ExpensesMetaController } from './expenses-meta.controller';
import { Project, ProjectSchema } from '../projects/project.schema';
import { ActivityModule } from '../activity/activity.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Expense.name, schema: ExpenseSchema },
      { name: Project.name, schema: ProjectSchema },
    ]),
    ActivityModule,
  ],
  providers: [ExpensesService],
  controllers: [ExpensesController, ExpensesMetaController],
  exports: [ExpensesService],
})
export class ExpensesModule {}
