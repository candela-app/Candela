import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { DocIdHistory } from './entities/docid-history.entity';
import { DocIdRequest } from './entities/docid-request.entity';
import { DoctorProfile } from './entities/doctor-profile.entity';
import { PatientProfile } from './entities/patient-profile.entity';
import { Prescription } from './entities/prescription.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { User } from './entities/user.entity';
import { InitAuth1740000000000 } from './migrations/1740000000000-InitAuth';
import { AddLevelsToPrescription1786860435953 } from './migrations/1786860435953-AddLevelsToPrescription';
import { AddDocIdRequestsAndHistory1787000000001 } from './migrations/1787000000001-AddDocIdRequestsAndHistory';
import { AddGoogleAuth1788000000000 } from './migrations/1788000000000-AddGoogleAuth';
import { postgresConnectionUrl } from './common/postgres-url';

config({ path: '.env' });

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: postgresConnectionUrl(process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL || ''),
  ssl: { rejectUnauthorized: false },
  extra: { ssl: { rejectUnauthorized: false } },
  entities: [User, DoctorProfile, PatientProfile, Prescription, RefreshToken, DocIdRequest, DocIdHistory],
  migrations: [
    InitAuth1740000000000,
    AddLevelsToPrescription1786860435953,
    AddDocIdRequestsAndHistory1787000000001,
    AddGoogleAuth1788000000000,
  ],
});

export default AppDataSource;
