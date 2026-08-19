import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class AppService {
  constructor(@Inject(DataSource) private readonly dataSource: DataSource) {}

  async getHealth(): Promise<{
    status: string;
    database: string;
    timestamp: string;
  }> {
    await this.dataSource.query('SELECT 1');
    return {
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString(),
    };
  }
}
