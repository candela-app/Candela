import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  // TODO: persist once DB is configured — stub for future game telemetry / persistence
  getHealth(): { status: string; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
