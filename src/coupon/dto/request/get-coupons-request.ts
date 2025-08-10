import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsEnum } from 'class-validator';
import { CouponStatus } from '../../enum/coupon-status.enum';

export class GetCouponsRequest {
  @ApiProperty({
    description: '페이지 번호',
    example: 1,
    minimum: 1,
  })
  @IsNumber()
  @IsNotEmpty()
  page: number;

  @ApiProperty({
    description: '페이지당 쿠폰 수',
    example: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsNumber()
  @IsNotEmpty()
  limit: number;

  @ApiProperty({
    description: '쿠폰 상태 필터',
    enum: CouponStatus,
    example: CouponStatus.AVAILABLE,
    required: false,
  })
  @IsEnum(CouponStatus)
  @IsOptional()
  status?: CouponStatus;
}
