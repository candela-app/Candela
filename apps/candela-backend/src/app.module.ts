import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { DocIdModule } from './docid/docid.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { postgresConnectionUrl } from './common/postgres-url';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
