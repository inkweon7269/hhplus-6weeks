import { ApiProperty } from '@nestjs/swagger';
import { CouponStatus } from '../../enum/coupon-status.enum';
import { CouponEntity } from '../../domain/coupon.entity';
import * as dayjs from 'dayjs';

export class CouponDetailResponse {
  @ApiProperty({
    description: '쿠폰 ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: '쿠폰 이름',
    example: '1,000원 할인 쿠폰',
  })
  name: string;

  @ApiProperty({
    description: '쿠폰 코드',
    example: 'ABC12341',
  })
  couponCode: string;

  @ApiProperty({
    description: '할인 금액',
    example: 1000,
  })
  discountAmount: number;

  @ApiProperty({
    description: '남은 재고 수량',
    example: 50,
  })
  remainingStock: number;

  @ApiProperty({
    description: '쿠폰 만료일',
    example: '2025-12-31',
  })
  expiryDate: string;

  @ApiProperty({
    description: '쿠폰 상태',
    enum: CouponStatus,
    example: CouponStatus.AVAILABLE,
  })
  status: CouponStatus;

  static of(entity: CouponEntity): CouponDetailResponse {
    const response = new CouponDetailResponse();

    response.id = entity.id;
    response.name = entity.name;
    response.couponCode = entity.couponCode;
    response.discountAmount = entity.discountAmount;
    response.remainingStock = entity.remainingStock;
    response.expiryDate = dayjs(entity.expiryDate).format('YYYY-MM-DD');
    response.status = entity.status;

    return response;
  }
}

export class GetCouponsResponse {
  @ApiProperty({
    description: '쿠폰 목록',
    type: [CouponDetailResponse],
  })
  list: CouponDetailResponse[];

  @ApiProperty({
    description: '전체 쿠폰 수',
    example: 5,
  })
  totalCount: number;

  @ApiProperty({
    description: '현재 페이지',
    example: 1,
  })
  currentPage: number;

  @ApiProperty({
    description: '전체 페이지 수',
    example: 1,
  })
  totalPages: number;
}
