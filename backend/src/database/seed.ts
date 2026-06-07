/**
 * Seed script — demo users, sample projects, tasks, and activity logs
 * so assessors see a populated dashboard immediately.
 *
 *   docker exec smart-pm-backend npm run seed
 */
import 'reflect-metadata';
import * as mongoose from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
dotenv.config();

const MONGO_URI =
  process.env.MONGO_URI ||
  'mongodb://admin:secret@localhost:27017/smartpm?authSource=admin';

function addDays(d: Date, days: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  r.setHours(12, 0, 0, 0);
  return r;
}

function hoursAgo(h: number) {
  return new Date(Date.now() - h * 60 * 60 * 1000);
}

const UserSchema = new mongoose.Schema(
  {
    name: String,
    email: String,
    password: String,
    role: {
      type: String,
      enum: ['admin', 'project_manager', 'member'],
      default: 'member',
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const ProjectSchema = new mongoose.Schema(
  {
    name: String,
    description: String,
    deadline: Date,
    status: { type: String, enum: ['Active', 'Completed', 'On Hold'], default: 'Active' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true },
);

const TaskSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    title: String,
    description: String,
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    dueDate: Date,
    priority: { type: String, enum: ['High', 'Medium', 'Low'], default: 'Medium' },
    status: { type: String, enum: ['Todo', 'In Progress', 'Completed'], default: 'Todo' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    attachments: { type: Array, default: [] },
    comments: { type: Array, default: [] },
  },
  { timestamps: true },
);

const ActivitySchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    actionType: String,
    entityType: String,
    entityId: mongoose.Schema.Types.ObjectId,
    description: String,
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  },
  { timestamps: true },
);

const ExpenseSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    category: {
      type: String,
      enum: ['Hosting', 'AI / API', 'Tools', 'Domain', 'Other'],
      required: true,
    },
    description: String,
    amount: Number,
    currency: { type: String, default: 'USD' },
    date: Date,
    notes: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB');

  const UserModel = mongoose.model('User', UserSchema);
  const ProjectModel = mongoose.model('Project', ProjectSchema);
  const TaskModel = mongoose.model('Task', TaskSchema);
  const ActivityModel = mongoose.model('Activity', ActivitySchema);
  const ExpenseModel = mongoose.model('Expense', ExpenseSchema);

  const conn = mongoose.connection;
  await Promise.all([
    UserModel.deleteMany({}),
    ProjectModel.deleteMany({}),
    TaskModel.deleteMany({}),
    ActivityModel.deleteMany({}),
    ExpenseModel.deleteMany({}),
    conn.collection('notifications').deleteMany({}).catch(() => undefined),
    conn.collection('groups').deleteMany({}).catch(() => undefined),
  ]);
  console.log('🗑️  Cleared existing data');

  const hash = (p: string) => bcrypt.hash(p, 12);

  const [admin, pm, john, jane] = await UserModel.insertMany([
    { name: 'Admin User', email: 'admin@smartpm.dev', password: await hash('admin123'), role: 'admin' },
    { name: 'Sarah Connor', email: 'pm@smartpm.dev', password: await hash('pm123456'), role: 'project_manager' },
    { name: 'John Doe', email: 'john@smartpm.dev', password: await hash('member123'), role: 'member' },
    { name: 'Jane Smith', email: 'jane@smartpm.dev', password: await hash('member123'), role: 'member' },
  ]);
  console.log('👤 Users seeded');

  const team = [pm._id, john._id, jane._id];
  const now = new Date();

  const [website, mobile, dashboard] = await ProjectModel.insertMany([
    {
      name: 'Website Redesign',
      description: 'Modernize marketing site with new brand and CMS integration.',
      deadline: addDays(now, 14),
      status: 'Active',
      createdBy: admin._id,
      leadId: pm._id,
      members: team,
    },
    {
      name: 'Mobile App',
      description: 'Cross-platform companion app for project tracking on the go.',
      deadline: addDays(now, 30),
      status: 'Active',
      createdBy: admin._id,
      leadId: pm._id,
      members: team,
    },
    {
      name: 'Admin Dashboard',
      description: 'Internal analytics dashboard for operations team.',
      deadline: addDays(now, 2),
      status: 'Active',
      createdBy: admin._id,
      leadId: pm._id,
      members: [pm._id, john._id],
    },
  ]);
  console.log('📁 Projects seeded');

  await TaskModel.insertMany([
    {
      project: website._id,
      title: 'Setup API',
      description: 'Configure REST endpoints and auth middleware.',
      assignedTo: john._id,
      dueDate: addDays(now, 5),
      priority: 'High',
      status: 'In Progress',
      createdBy: pm._id,
    },
    {
      project: website._id,
      title: 'Homepage Design',
      description: 'Hero section, feature grid, and footer mockups.',
      assignedTo: jane._id,
      dueDate: addDays(now, 7),
      priority: 'Medium',
      status: 'Completed',
      createdBy: pm._id,
    },
    {
      project: website._id,
      title: 'SEO Audit',
      assignedTo: john._id,
      dueDate: addDays(now, 10),
      priority: 'Low',
      status: 'Todo',
      createdBy: admin._id,
    },
    {
      project: mobile._id,
      title: 'Push Notifications',
      assignedTo: jane._id,
      dueDate: addDays(now, 12),
      priority: 'High',
      status: 'In Progress',
      createdBy: pm._id,
    },
    {
      project: mobile._id,
      title: 'Offline Sync',
      assignedTo: john._id,
      dueDate: addDays(now, 20),
      priority: 'Medium',
      status: 'Todo',
      createdBy: pm._id,
    },
    {
      project: dashboard._id,
      title: 'KPI Widgets',
      assignedTo: john._id,
      dueDate: addDays(now, 1),
      priority: 'High',
      status: 'In Progress',
      createdBy: pm._id,
    },
    {
      project: dashboard._id,
      title: 'Export Reports',
      assignedTo: john._id,
      dueDate: addDays(now, -1),
      priority: 'Medium',
      status: 'Todo',
      createdBy: admin._id,
    },
  ]);
  console.log('✅ Tasks seeded');

  await ExpenseModel.insertMany([
    {
      project: website._id,
      category: 'Hosting',
      description: 'Vercel Pro plan',
      amount: 20,
      currency: 'USD',
      date: addDays(now, -10),
      createdBy: admin._id,
    },
    {
      project: website._id,
      category: 'AI / API',
      description: 'OpenAI API credits',
      amount: 85,
      currency: 'USD',
      date: addDays(now, -5),
      notes: 'June billing cycle',
      createdBy: pm._id,
    },
    {
      project: mobile._id,
      category: 'Tools',
      description: 'Expo EAS build credits',
      amount: 29,
      currency: 'USD',
      date: addDays(now, -7),
      createdBy: pm._id,
    },
    {
      project: mobile._id,
      category: 'Hosting',
      description: 'MongoDB Atlas M10',
      amount: 57,
      currency: 'USD',
      date: addDays(now, -3),
      createdBy: admin._id,
    },
    {
      project: dashboard._id,
      category: 'Domain',
      description: 'smartpm.nexarift.com renewal',
      amount: 12,
      currency: 'USD',
      date: addDays(now, -14),
      createdBy: admin._id,
    },
  ]);
  console.log('💰 Expenses seeded');

  await ActivityModel.insertMany([
    {
      actor: admin._id,
      actionType: 'project_created',
      entityType: 'project',
      entityId: website._id,
      project: website._id,
      description: 'Project "Website Redesign" created',
      createdAt: hoursAgo(48),
    },
    {
      actor: pm._id,
      actionType: 'task_assigned',
      entityType: 'task',
      project: website._id,
      description: 'Task "Setup API" assigned to John Doe',
      createdAt: hoursAgo(36),
    },
    {
      actor: jane._id,
      actionType: 'status_changed',
      entityType: 'task',
      project: website._id,
      description: 'Task "Homepage Design" marked as Completed',
      createdAt: hoursAgo(24),
    },
    {
      actor: admin._id,
      actionType: 'member_added',
      entityType: 'member',
      project: dashboard._id,
      description: 'John Doe added to "Admin Dashboard"',
      createdAt: hoursAgo(12),
    },
    {
      actor: pm._id,
      actionType: 'project_created',
      entityType: 'project',
      entityId: mobile._id,
      project: mobile._id,
      description: 'Project "Mobile App" created',
      createdAt: hoursAgo(6),
    },
  ]);
  console.log('📋 Activity log seeded');

  console.log('\n🎉 Seed complete! Demo credentials:');
  console.log('   Admin   → admin@smartpm.dev  / admin123');
  console.log('   PM      → pm@smartpm.dev     / pm123456');
  console.log('   Member  → john@smartpm.dev   / member123');
  console.log('   Member  → jane@smartpm.dev   / member123');
  console.log('\nSample data: 3 projects, 7 tasks, 5 expenses, 5 activity entries.\n');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
