import { ApiProperty } from '@nestjs/swagger';
import { CollectionMetaDto } from './collection-meta.dto';
import { ICollectionResponse } from '../interfaces/pagination.interface';

export class CollectionResponseDto<T> implements ICollectionResponse<T> {
  @ApiProperty({ isArray: true })
  data: T[];

  @ApiProperty({ type: () => CollectionMetaDto })
  meta: CollectionMetaDto;

  constructor(data: T[], meta: CollectionMetaDto) {
    this.data = data;
    this.meta = meta;
  }
}
