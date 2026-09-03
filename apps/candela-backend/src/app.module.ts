import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { DocIdModule } from './docid/docid.module';
import { FamiliarFacesModule } from './familiar-faces/familiar-faces.module';
import { GameSessionsModule } from './game-sessions/game-sessions.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BACKEND_ENV_PATH, loadBackendEnv } from './common/load-env';
import { postgresConnectionUrl } from './common/postgres-url';

loadBackendEnv();

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: BACKEND_ENV_PATH,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: postgresConnectionUrl(config.getOrThrow<string>('DATABASE_URL')),
        autoLoadEntities: true,
        synchronize: false,
        ssl: { rejectUnauthorized: false },
        extra: { ssl: { rejectUnauthorized: false } },
      }),
    }),
    AuthModule,
    DocIdModule,
    FamiliarFacesModule,
    GameSessionsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
