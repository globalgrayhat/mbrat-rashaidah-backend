import { Injectable } from '@nestjs/common';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import {
  IPaginationParams,
  IPaginationMeta,
} from './interfaces/pagination.interface';

export const MAX_LIMIT = 100;
export const DEFAULT_LIMIT = 10;
export const MIN_PAGE = 1;
export const MIN_OFFSET = 0;

@Injectable()
export class PaginationHelper {
  normalizeParams(query: PaginationQueryDto): IPaginationParams {
    const limit = this.normalizeLimit(query.limit);
    const page = this.normalizePage(query.page);
    const offset = this.normalizeOffset(query.offset);

    let skip: number;

    if (offset !== undefined && offset !== null) {
      skip = Math.max(MIN_OFFSET, offset);
    } else {
      skip = (page - 1) * limit;
    }

    return {
      skip,
      take: limit,
      order: this.buildOrder(query.sortBy, query.sortOrder),
    };
  }

  buildMeta(
    total: number,
    params: IPaginationParams,
    page: number,
    offset: number | undefined,
  ): IPaginationMeta {
    const totalPages = Math.ceil(total / params.take);

    return {
      page,
      limit: params.take,
      offset: offset ?? params.skip,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };
  }

  private normalizeLimit(limit?: number): number {
    if (!limit || limit <= 0) return DEFAULT_LIMIT;
    return Math.min(limit, MAX_LIMIT);
  }

  private normalizePage(page?: number): number {
    if (!page || page < MIN_PAGE) return MIN_PAGE;
    return page;
  }

  private normalizeOffset(offset?: number): number | undefined {
    if (offset === undefined || offset === null) return undefined;
    return Math.max(MIN_OFFSET, offset);
  }

  private buildOrder(
    sortBy?: string,
    sortOrder?: 'ASC' | 'DESC',
  ): Record<string, 'ASC' | 'DESC'> {
    if (!sortBy) return { createdAt: 'DESC' };
    return { [sortBy]: sortOrder || 'DESC' };
  }
}
