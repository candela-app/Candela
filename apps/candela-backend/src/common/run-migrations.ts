import { AppDataSource } from '../data-source';

export async function runPendingMigrations(): Promise<number> {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
  const results = await AppDataSource.runMigrations();
  if (results.length === 0) {
    console.log('No pending migrations');
  } else {
    for (const migration of results) {
      console.log(`Ran migration ${migration.name}`);
    }
  }
  await AppDataSource.destroy();
  return results.length;
}
