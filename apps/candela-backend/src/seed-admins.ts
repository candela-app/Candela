import 'reflect-metadata';
import bcrypt from 'bcrypt';
import { AppDataSource } from './data-source';
import { User } from './entities/user.entity';

const ADMINS = [
  { email: 'sai@candela.com', password: 'sai123$', name: 'Sai' },
  { email: 'satvik@candela.com', password: 'satvik123$', name: 'Satvik' },
];

async function run() {
  const ds = await AppDataSource.initialize();
  const users = ds.getRepository(User);
  for (const admin of ADMINS) {
    const email = admin.email.trim().toLowerCase();
    const existing = await users.findOne({ where: { email } });
    if (existing) {
      console.log(`Admin already exists: ${email}`);
      continue;
    }
    await users.save(
      users.create({
        email,
        passwordHash: await bcrypt.hash(admin.password, 10),
        name: admin.name,
        phone: '0000000000',
        role: 'admin',
      }),
    );
    console.log(`Seeded admin: ${email}`);
  }
  await ds.destroy();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
