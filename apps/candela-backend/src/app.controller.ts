import { Controller, Get, Inject } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './common/decorators';

@Controller('api')
export class AppController {
  constructor(@Inject(AppService) private readonly appService: AppService) {}

  @Public()
  @Get('health')
  getHealth() {
    return this.appService.getHealth();
  }
}
