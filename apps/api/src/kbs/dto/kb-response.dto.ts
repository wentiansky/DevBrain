import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class KbResponse {
  @ApiProperty({ description: 'KB ID' })
  id!: string;

  @ApiProperty({ description: 'KB 名称' })
  name!: string;

  @ApiPropertyOptional({ description: 'KB 描述' })
  description?: string;

  @ApiProperty({ description: '创建时间' })
  createdAt!: Date;

  @ApiProperty({ description: '更新时间' })
  updatedAt!: Date;
}

export class KbListResponse {
  @ApiProperty({ description: 'KB 列表', type: [KbResponse] })
  items!: KbResponse[];
}