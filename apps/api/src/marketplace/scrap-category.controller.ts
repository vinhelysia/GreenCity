import { Controller, Get } from '@nestjs/common';
import { Public } from '../authz/authenticated.guard';
import { ScrapCategoryService } from './scrap-category.service';

@Controller('scrap-categories')
export class ScrapCategoryController {
  constructor(private readonly categories: ScrapCategoryService) {}

  /** Transparent pricing: anyone can see the published bands before submitting. */
  @Public()
  @Get()
  list() {
    return this.categories.listActive();
  }
}
