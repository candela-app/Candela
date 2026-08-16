import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { DoctorProfile } from './entities/doctor-profile.entity';
import { PatientProfile } from './entities/patient-profile.entity';
import { Prescription } from './entities/prescription.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { User } from './entities/user.entity';
import { InitAuth1740000000000 } from './migrations/1740000000000-InitAuth';

config({ path: '.env' });

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  entities: [User, DoctorProfile, PatientProfile, Prescription, RefreshToken],
  migrations: [InitAuth1740000000000],
});

export default AppDataSource;
