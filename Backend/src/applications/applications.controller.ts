import { Body, Controller, Post } from '@nestjs/common';
import { ApplicationsService } from './applications.service';
import { ApplyDto } from './dto';

@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}

  @Post()
  apply(@Body() dto: ApplyDto) {
    return this.applications.apply(dto);
  }

}
