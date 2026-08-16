import 'reflect-metadata';
import { AppDataSource } from './data-source';

async function run() {
  const ds = await AppDataSource.initialize();
  const results = await ds.runMigrations();
  if (results.length === 0) {
    console.log('No pending migrations');
  } else {
    for (const migration of results) {
      console.log(`Ran migration ${migration.name}`);
    }
  }
  await ds.destroy();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
