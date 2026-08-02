import { Controller, Get } from '@nestjs/common';
import { ApartmentsService } from './apartments.service';

@Controller()
export class ApartmentsController {
  constructor(private readonly apartments: ApartmentsService) {}

  @Get('apartments')
  listAvailable() {
    return this.apartments.listAvailable();
  }
}
