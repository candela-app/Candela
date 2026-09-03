import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { DocIdHistory } from './entities/docid-history.entity';
import { DocIdRequest } from './entities/docid-request.entity';
import { DoctorProfile } from './entities/doctor-profile.entity';
import { PatientProfile } from './entities/patient-profile.entity';
import { Prescription } from './entities/prescription.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { User } from './entities/user.entity';
import { FamiliarFace } from './entities/familiar-face.entity';
import { GameSession } from './entities/game-session.entity';
import { InitAuth1740000000000 } from './migrations/1740000000000-InitAuth';
import { AddLevelsToPrescription1786860435953 } from './migrations/1786860435953-AddLevelsToPrescription';
import { AddDocIdRequestsAndHistory1787000000001 } from './migrations/1787000000001-AddDocIdRequestsAndHistory';
import { AddGoogleAuth1788000000000 } from './migrations/1788000000000-AddGoogleAuth';
import { AddFamiliarFaces1789000000000 } from './migrations/1789000000000-AddFamiliarFaces';
import { AddGameSessions1790000000000 } from './migrations/1790000000000-AddGameSessions';
import { loadBackendEnv } from './common/load-env';
import { postgresConnectionUrl } from './common/postgres-url';

loadBackendEnv();

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: postgresConnectionUrl(process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL || ''),
  ssl: { rejectUnauthorized: false },
  extra: { ssl: { rejectUnauthorized: false } },
  entities: [
    User,
    DoctorProfile,
    PatientProfile,
    Prescription,
    RefreshToken,
    DocIdRequest,
    DocIdHistory,
    FamiliarFace,
    GameSession,
  ],
  migrations: [
    InitAuth1740000000000,
    AddLevelsToPrescription1786860435953,
    AddDocIdRequestsAndHistory1787000000001,
    AddGoogleAuth1788000000000,
    AddFamiliarFaces1789000000000,
    AddGameSessions1790000000000,
  ],
});

export default AppDataSource;
