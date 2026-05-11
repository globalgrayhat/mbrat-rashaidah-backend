import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsInt, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ReorderItemDto {
  @ApiProperty({ example: 'uuid-here' })
  @IsUUID()
  id: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  pinnedOrder: number;
}

export class ReorderPinnedDto {
  @ApiProperty({ type: [ReorderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  items: ReorderItemDto[];
}
