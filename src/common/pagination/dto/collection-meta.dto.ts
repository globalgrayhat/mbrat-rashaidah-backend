import { ApiProperty } from '@nestjs/swagger';
import { IPaginationMeta } from '../interfaces/pagination.interface';

export class CollectionMetaDto implements IPaginationMeta {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({ example: 0 })
  offset: number;

  @ApiProperty({ example: 250 })
  total: number;

  @ApiProperty({ example: 25 })
  totalPages: number;

  @ApiProperty({ example: true })
  hasNextPage: boolean;

  @ApiProperty({ example: false })
  hasPrevPage: boolean;
}
