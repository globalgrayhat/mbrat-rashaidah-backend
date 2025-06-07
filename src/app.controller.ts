import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHealth(): {
    message: string;
    appName: string;
  } {
    return this.appService.getHealth();
  }
}
