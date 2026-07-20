import { Controller, Get } from '@nestjs/common';
import { Public } from '../authz/authenticated.guard';
import { ScrapCategoryService } from './scrap-category.service';

@Controller('scrap-categories')
export class ScrapCategoryController {
  constructor(private readonly categories: ScrapCategoryService) {}

  /** Transparent pricing: anyone can see the published bands before submitting. */
  @Public()
  @Get()
  async list() {
    // Wrapped like the request/listing lists so clients parse one shape.
    return { categories: await this.categories.listActive() };
  }
}
