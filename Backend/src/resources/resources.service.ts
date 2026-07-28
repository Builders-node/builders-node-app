import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

type ResourceInput = {
  title?: string;
  slug?: string;
  category?: string;
  body?: string;
  published?: boolean;
  order?: number;
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

@Injectable()
export class ResourcesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Published articles for members, grouped-friendly (ordered by category then order). */
  listPublished() {
    return this.prisma.resource.findMany({
      where: { published: true },
      orderBy: [{ category: 'asc' }, { order: 'asc' }, { title: 'asc' }],
    });
  }

  // ── Admin ──────────────────────────────────────────────────────────────────

  listAll() {
    return this.prisma.resource.findMany({ orderBy: [{ category: 'asc' }, { order: 'asc' }, { title: 'asc' }] });
  }

  async create(input: ResourceInput) {
    const title = input.title?.trim();
    if (!title) throw new BadRequestException('Title is required.');
    const slug = (input.slug?.trim() ? slugify(input.slug) : slugify(title)) || `article-${Date.now()}`;
    return this.prisma.resource.create({
      data: {
        title,
        slug,
        category: input.category?.trim() || 'General',
        body: input.body ?? '',
        published: input.published ?? true,
        order: input.order ?? 0,
      },
    });
  }

  async update(id: string, input: ResourceInput) {
    await this.require(id);
    return this.prisma.resource.update({
      where: { id },
      data: {
        title: input.title?.trim() || undefined,
        slug: input.slug?.trim() ? slugify(input.slug) : undefined,
        category: input.category?.trim() || undefined,
        body: input.body ?? undefined,
        published: input.published,
        order: input.order,
      },
    });
  }

  async remove(id: string) {
    await this.require(id);
    await this.prisma.resource.delete({ where: { id } });
    return { deleted: true, id };
  }

  private async require(id: string) {
    const found = await this.prisma.resource.findUnique({ where: { id }, select: { id: true } });
    if (!found) throw new NotFoundException('Resource not found.');
    return found;
  }
}
