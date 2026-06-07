import 'reflect-metadata';
import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://admin:secret@localhost:27017/smartpm?authSource=admin';

async function clear() {
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB');

  const db = mongoose.connection.db;
  if (!db) throw new Error('DB connection not established');
  const [projects, tasks, activities] = await Promise.all([
    db.collection('projects').deleteMany({}),
    db.collection('tasks').deleteMany({}),
    db.collection('activities').deleteMany({}),
  ]);

  console.log(`🗑️  Deleted ${projects.deletedCount} projects`);
  console.log(`🗑️  Deleted ${tasks.deletedCount} tasks`);
  console.log(`🗑️  Deleted ${activities.deletedCount} activity logs`);
  console.log('👤 Users kept intact');

  await mongoose.disconnect();
  process.exit(0);
}

clear().catch((err) => {
  console.error('❌ Clear failed:', err);
  process.exit(1);
});
