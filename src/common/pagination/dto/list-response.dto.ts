import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ListMetaDto {
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

export class ListResponseDto<T> {
  @ApiProperty({ type: () => Array })
  data: T[];

  @ApiProperty({ type: () => ListMetaDto })
  meta: ListMetaDto;

  constructor(data: T[], meta: ListMetaDto) {
    this.data = data;
    this.meta = meta;
  }
}
