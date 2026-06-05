// This runs on first container start to create the app user
db = db.getSiblingDB('smartpm');
db.createUser({
  user: 'smartpm_user',
  pwd: 'smartpm_pass',
  roles: [{ role: 'readWrite', db: 'smartpm' }],
});
db.createCollection('users');
print('MongoDB initialized for smartpm database');
