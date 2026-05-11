import { Injectable } from '@nestjs/common';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import {
  IPaginationParams,
  IPaginationMeta,
} from './interfaces/pagination.interface';
import {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  MIN_OFFSET,
  MIN_PAGE,
} from './constants/pagination.constant';
import { CollectionMetaDto } from './dto/collection-meta.dto';
import { CollectionResponseDto } from './dto/collection-response.dto';

@Injectable()
export class PaginationService {
  /**
   * Normalizes raw query parameters into validated pagination parameters.
   */
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
      order: { [query.sortBy || 'createdAt']: query.sortOrder || 'DESC' },
      search: query.search,
    };
  }

  /**
   * Builds metadata for the response.
   */
  buildMeta(
    total: number,
    params: IPaginationParams,
    query: PaginationQueryDto,
  ): CollectionMetaDto {
    const limit = params.take;
    const totalPages = Math.ceil(total / limit);
    
    // If offset was provided, we calculate the logical page
    const page = query.offset !== undefined 
      ? Math.floor(query.offset / limit) + 1 
      : (query.page || MIN_PAGE);

    return {
      page,
      limit,
      offset: query.offset ?? params.skip,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };
  }

  /**
   * Wraps data and total into a CollectionResponseDto.
   */
  createResponse<T>(
    data: T[],
    total: number,
    query: PaginationQueryDto,
  ): CollectionResponseDto<T> {
    const params = this.normalizeParams(query);
    const meta = this.buildMeta(total, params, query);
    return new CollectionResponseDto(data, meta);
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
}
