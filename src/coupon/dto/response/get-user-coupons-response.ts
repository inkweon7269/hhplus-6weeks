import { ApiProperty } from '@nestjs/swagger';
import { UserCouponStatus } from '../../enum/coupon-status.enum';
import { UserCouponEntity } from '../../domain/user-coupon.entity';
import * as dayjs from 'dayjs';

export class UserCouponDetailResponse {
  @ApiProperty({
    description: '쿠폰 ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: '발급된 쿠폰 코드',
    example: 'ABC123412',
  })
  couponCode: string;

  @ApiProperty({
    description: '쿠폰 이름',
    example: '1,000원 할인 쿠폰',
  })
  couponName: string;

  @ApiProperty({
    description: '할인 금액',
    example: 1000,
  })
  discountAmount: number;

  @ApiProperty({
    description: '발급일',
    example: '2025-01-15',
  })
  issuedDate: string;

  @ApiProperty({
    description: '만료일',
    example: '2025-04-15',
  })
  expiryDate: string;

  @ApiProperty({
    description: '쿠폰 상태',
    enum: UserCouponStatus,
    example: UserCouponStatus.AVAILABLE,
  })
  status: UserCouponStatus;

  @ApiProperty({
    description: '사용일 (사용한 경우만)',
    example: null,
    nullable: true,
  })
  usedDate: string | null;

  @ApiProperty({
    description: '사용자 ID',
    example: 1,
  })
  userId: number;

  static of(entity: UserCouponEntity): UserCouponDetailResponse {
    const response = new UserCouponDetailResponse();

    response.id = entity.id;
    response.userId = entity.userId;
    response.issuedDate = dayjs(entity.createdAt).format('YYYY-MM-DD');
    response.status = entity.status;
    response.usedDate = entity.usedDate ? dayjs(entity.usedDate).format('YYYY-MM-DD') : null;

    if (entity.coupon) {
      response.couponCode = entity.coupon.couponCode;
      response.couponName = entity.coupon.name;
      response.discountAmount = entity.coupon.discountAmount;
      response.expiryDate = dayjs(entity.coupon.expiryDate).format('YYYY-MM-DD');
    }

    return response;
  }
}

export class GetUserCouponsResponse {
  @ApiProperty({
    description: '사용자 보유 쿠폰 목록',
    type: [UserCouponDetailResponse],
  })
  list: UserCouponDetailResponse[];

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
