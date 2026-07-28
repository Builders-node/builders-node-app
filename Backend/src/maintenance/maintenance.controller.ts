import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../admin/admin.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MaintenanceService } from './maintenance.service';

type CreateBody = { category?: string; title?: string; description?: string; photoFileName?: string; photoFileType?: string; photoBase64?: string };

@Controller()
export class MaintenanceController {
  constructor(private readonly maintenance: MaintenanceService) {}

  // Member: submit + list own requests. Guard restricts :userId to the owner.
  @UseGuards(JwtAuthGuard)
  @Post('users/:userId/maintenance')
  create(@Param('userId') userId: string, @Body() body: CreateBody) {
    return this.maintenance.create(userId, body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('users/:userId/maintenance')
  listMine(@Param('userId') userId: string) {
    return this.maintenance.listForUser(userId);
  }

  // Admin queue.
  @UseGuards(AdminGuard)
  @Get('admin/maintenance')
  adminList() {
    return this.maintenance.adminList();
  }

  @UseGuards(AdminGuard)
  @Patch('admin/maintenance/:id')
  adminUpdate(@Param('id') id: string, @Body() body: { status?: string; adminNote?: string }) {
    return this.maintenance.adminUpdate(id, body);
  }

  @UseGuards(AdminGuard)
  @Get('admin/maintenance/:id/photo')
  photo(@Param('id') id: string) {
    return this.maintenance.getPhoto(id);
  }
}
