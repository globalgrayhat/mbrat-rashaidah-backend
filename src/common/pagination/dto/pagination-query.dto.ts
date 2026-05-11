import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import {
  DEFAULT_LIMIT,
  DEFAULT_SORT_BY,
  DEFAULT_SORT_ORDER,
  MAX_LIMIT,
  MIN_OFFSET,
  MIN_PAGE,
} from '../constants/pagination.constant';

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Page number',
    minimum: MIN_PAGE,
    default: MIN_PAGE,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(MIN_PAGE)
  page?: number = MIN_PAGE;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    minimum: 1,
    maximum: MAX_LIMIT,
    default: DEFAULT_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LIMIT)
  limit?: number = DEFAULT_LIMIT;

  @ApiPropertyOptional({
    description: 'Offset (overrides page)',
    minimum: MIN_OFFSET,
    default: MIN_OFFSET,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(MIN_OFFSET)
  offset?: number;

  @ApiPropertyOptional({ description: 'Search term' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Sort by field', default: DEFAULT_SORT_BY })
  @IsOptional()
  @IsString()
  sortBy?: string = DEFAULT_SORT_BY;

  @ApiPropertyOptional({ description: 'Sort order', enum: SortOrder, default: DEFAULT_SORT_ORDER })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.DESC;

  @ApiPropertyOptional({ description: 'Category ID filter' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Country ID filter' })
  @IsOptional()
  @IsString()
  countryId?: string;
}
