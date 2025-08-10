import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsPositive, Min } from 'class-validator';
import { IsMultipleOfHundred } from '../../../common/decorator/validation.decorator';

export class BalanceRechargeRequest {
  @ApiProperty({
    description: '충전 금액 (100원 단위로만 충전 가능)',
    example: 100000,
    minimum: 100,
    multipleOf: 100,
  })
  @IsNumber()
  @IsNotEmpty()
  @IsPositive()
  @Min(100, { message: '충전 금액은 최소 100원 이상이어야 합니다.' })
  @IsMultipleOfHundred({ message: '충전 금액은 100원 단위로만 입력 가능합니다.' })
  amount: number;
}
