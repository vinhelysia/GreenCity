import { Injectable } from '@nestjs/common';
import type { ScrapCategory } from '@greencity/shared';
import { PrismaService } from '../prisma/prisma.service';
import { toCategoryDto } from './marketplace.mapper';

@Injectable()
export class ScrapCategoryService {
  constructor(private readonly prisma: PrismaService) {}

  async listActive(): Promise<ScrapCategory[]> {
    const rows = await this.prisma.scrapCategory.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    });
    return rows.map(toCategoryDto);
  }
}
