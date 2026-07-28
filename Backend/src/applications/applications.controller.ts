import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApplicationsService } from './applications.service';
import { ApplyDto, ConfirmApplicationDto, CreateAccountDto } from './dto';

@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}

  // Step 1: submit the form → email a confirmation code (rate-limited to curb abuse).
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('request-code')
  requestCode(@Body() dto: ApplyDto) {
    return this.applications.requestCode(dto);
  }

  // Step 2: confirm the emailed code → create the application.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('confirm')
  confirm(@Body() dto: ConfirmApplicationDto) {
    return this.applications.confirmCode(dto);
  }

  // Step 3 (only when no account yet): set a password → create the login + sign in.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('create-account')
  createAccount(@Body() dto: CreateAccountDto) {
    return this.applications.createAccountFromApply(dto);
  }
}
