import bcrypt from 'bcrypt';
import type { Repository } from 'typeorm';
import { User } from '../entities/user.entity';

const BCRYPT_ROUNDS = 10;
const MAX_NUMBERED_ADMINS = 9;
const MIN_PASSWORD_LENGTH = 8;

export interface AdminSeedAccount {
  email: string;
  password: string;
  name: string;
}

export interface AdminSeedResult {
  created: number;
  updated: number;
  skipped: number;
}

function readSlot(env: NodeJS.ProcessEnv, prefix: string): AdminSeedAccount | null {
  const email = env[`${prefix}EMAIL`]?.trim().toLowerCase();
  const password = env[`${prefix}PASSWORD`] ?? '';
  const name = env[`${prefix}NAME`]?.trim();
  if (!email || !password) {
    return null;
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    console.warn('Admin seed skipped an entry: password is too short');
    return null;
  }
  return {
    email,
    password,
    name: name && name.length > 0 ? name : email.split('@')[0],
  };
}

/** Reads admin credentials from the environment. Never log the returned passwords. */
export function parseAdminSeedFromEnv(env: NodeJS.ProcessEnv = process.env): AdminSeedAccount[] {
  const byEmail = new Map<string, AdminSeedAccount>();

  for (let i = 1; i <= MAX_NUMBERED_ADMINS; i += 1) {
    const account = readSlot(env, `ADMIN_${i}_`);
    if (account) {
      byEmail.set(account.email, account);
    }
  }

  if (byEmail.size === 0) {
    const account = readSlot(env, 'ADMIN_');
    if (account) {
      byEmail.set(account.email, account);
    }
  }

  return [...byEmail.values()];
}

export function adminSeedOverwriteEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = (env.ADMIN_SEED_OVERWRITE || '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

export async function seedAdminUsers(
  users: Repository<User>,
  options: { overwrite?: boolean } = {},
): Promise<AdminSeedResult> {
  const overwrite = options.overwrite ?? adminSeedOverwriteEnabled();
  const accounts = parseAdminSeedFromEnv();
  const result: AdminSeedResult = { created: 0, updated: 0, skipped: 0 };

  if (accounts.length === 0) {
    console.log('Admin seed skipped: no ADMIN_* credentials in the environment');
    return result;
  }

  for (const account of accounts) {
    const existing = await users.findOne({ where: { email: account.email } });
    const passwordHash = await bcrypt.hash(account.password, BCRYPT_ROUNDS);

    if (!existing) {
      await users.save(
        users.create({
          email: account.email,
          passwordHash,
          name: account.name,
          phone: '0000000000',
          role: 'admin',
        }),
      );
      result.created += 1;
      continue;
    }

    if (!overwrite) {
      result.skipped += 1;
      continue;
    }

    existing.passwordHash = passwordHash;
    existing.name = account.name;
    if (existing.role !== 'admin') {
      existing.role = 'admin';
    }
    await users.save(existing);
    result.updated += 1;
  }

  console.log(
    `Admin seed complete (created ${result.created}, updated ${result.updated}, skipped ${result.skipped})`,
  );
  return result;
}
