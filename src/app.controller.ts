import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  constructor() {}

  @Get()
  getHello(): string {
    return "Welcome to Multi Vendor E-Commerce Platform";
  }
}
