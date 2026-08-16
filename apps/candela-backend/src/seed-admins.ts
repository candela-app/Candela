import 'reflect-metadata';
import { config } from 'dotenv';
import { seedAdminUsers } from './common/admin-seed';
import { AppDataSource } from './data-source';
import { User } from './entities/user.entity';

config({ path: '.env' });

async function run() {
  const ds = await AppDataSource.initialize();
  const users = ds.getRepository(User);
  await seedAdminUsers(users);
  await ds.destroy();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
