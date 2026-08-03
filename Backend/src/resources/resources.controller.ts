import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../admin/admin.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ResourcesService } from './resources.service';

type ResourceBody = { title?: string; slug?: string; category?: string; body?: string; published?: boolean; order?: number };

@Controller()
export class ResourcesController {
  constructor(private readonly resources: ResourcesService) {}

  // Members: published articles only.
  @UseGuards(JwtAuthGuard)
  @Get('resources')
  list() {
    return this.resources.listPublished();
  }

  // Admin CRUD.
  @UseGuards(AdminGuard)
  @Get('admin/resources')
  adminList() {
    return this.resources.listAll();
  }

  @UseGuards(AdminGuard)
  @Post('admin/resources')
  create(@Body() body: ResourceBody) {
    return this.resources.create(body);
  }

  @UseGuards(AdminGuard)
  @Patch('admin/resources/:id')
  update(@Param('id') id: string, @Body() body: ResourceBody) {
    return this.resources.update(id, body);
  }

  @UseGuards(AdminGuard)
  @Delete('admin/resources/:id')
  remove(@Param('id') id: string) {
    return this.resources.remove(id);
  }

  @UseGuards(AdminGuard)
  @Patch('admin/resources/:id/reorder')
  reorder(@Param('id') id: string, @Body() body: { direction?: 'up' | 'down' }) {
    return this.resources.reorder(id, body.direction ?? 'up');
  }
}
