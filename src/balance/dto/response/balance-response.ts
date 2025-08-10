import { ApiProperty } from '@nestjs/swagger';
import { BalanceEntity } from 'src/balance/domain/balance.entity';
import * as dayjs from 'dayjs';

export class BalanceResponse {
  @ApiProperty({
    description: '잔액 ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: '생성일시',
    example: '2024-01-01 00:00:00',
  })
  createdAt: string;

  @ApiProperty({
    description: '수정일시',
    example: '2024-01-01 00:00:00',
  })
  updatedAt: string;

  @ApiProperty({
    description: '사용자 ID',
    example: 1,
  })
  userId: number;

  @ApiProperty({
    description: '잔액',
    example: 150000,
  })
  amount: number;

  static of(entity: BalanceEntity) {
    const res = new BalanceResponse();

    res.id = entity.id;
    res.createdAt = dayjs(entity.createdAt).format('YYYY-MM-DD HH:mm:ss');
    res.updatedAt = dayjs(entity.updatedAt).format('YYYY-MM-DD HH:mm:ss');
    res.userId = entity.userId;
    res.amount = entity.amount;

    return res;
  }
}
