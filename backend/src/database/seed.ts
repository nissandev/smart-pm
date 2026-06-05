/**
 * Seed script — creates only the demo USER accounts so evaluators can
 * log in immediately. Projects, tasks, and activity logs are intentionally
 * NOT seeded — those are created by users through the app.
 *
 * Run inside the container or locally:
 *   docker exec smart-pm-backend npm run seed
 *   OR (from backend/, with a correct MONGO_URI in .env):
 *   npm run seed
 *
 * Note: the script clears `projects`, `tasks`, and `activities` along with
 * `users` so we never end up with orphaned documents that reference user
 * IDs that have been re-generated.
 */
import 'reflect-metadata';
import * as mongoose from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
dotenv.config();

const MONGO_URI =
  process.env.MONGO_URI ||
  'mongodb://admin:secret@localhost:27017/smartpm?authSource=admin';

// ── Inline schemas (avoid circular imports) ─────────────────────
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

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB');

  const UserModel = mongoose.model('User', UserSchema);

  // Wipe users + everything that references them so the DB stays consistent.
  // We use raw collection access for projects/tasks/activities because we
  // don't want to declare and import their full schemas here.
  const conn = mongoose.connection;
  await Promise.all([
    UserModel.deleteMany({}),
    conn.collection('projects').deleteMany({}).catch(() => undefined),
    conn.collection('tasks').deleteMany({}).catch(() => undefined),
    conn.collection('activities').deleteMany({}).catch(() => undefined),
    conn.collection('notifications').deleteMany({}).catch(() => undefined),
  ]);
  console.log('🗑️  Cleared users, projects, tasks, activities, notifications');

  // ── Users (demo accounts only) ───────────────────────────────
  const hash = (p: string) => bcrypt.hash(p, 12);

  await UserModel.insertMany([
    { name: 'Admin User', email: 'admin@smartpm.dev', password: await hash('admin123'), role: 'admin' },
    { name: 'Sarah Connor', email: 'pm@smartpm.dev', password: await hash('pm123456'), role: 'project_manager' },
    { name: 'John Doe', email: 'john@smartpm.dev', password: await hash('member123'), role: 'member' },
    { name: 'Jane Smith', email: 'jane@smartpm.dev', password: await hash('member123'), role: 'member' },
  ]);
  console.log('👤 Users seeded');

  console.log('\n🎉 Seed complete! Demo credentials:');
  console.log('   Admin   → admin@smartpm.dev  / admin123');
  console.log('   PM      → pm@smartpm.dev     / pm123456');
  console.log('   Member  → john@smartpm.dev   / member123');
  console.log('   Member  → jane@smartpm.dev   / member123');
  console.log('\nProjects, tasks, and activity logs are intentionally empty —');
  console.log('create them through the app to exercise the real flows.\n');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
