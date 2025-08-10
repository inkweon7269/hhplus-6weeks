import { Controller, Get, Post, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CouponFacade } from './coupon.facade';
import { GetUserCouponsRequest } from './dto/request/get-user-coupons-request';
import { GetUserCouponsResponse, UserCouponDetailResponse } from './dto/response/get-user-coupons-response';
import { GetCouponsRequest } from './dto/request/get-coupons-request';
import { GetCouponsResponse } from './dto/response/get-coupons-response';
import { UserId } from '../common/decorator/user-id.decorator';

@ApiTags('선착순 쿠폰 관리')
@Controller('coupons')
export class CouponController {
  constructor(private readonly couponFacade: CouponFacade) {}

  @ApiOperation({ summary: '선착순 쿠폰 발급', description: '로그인한 사용자에게 선착순 쿠폰을 발급합니다.' })
  @Post(':couponId/issue')
  async issueCoupon(@UserId() userId: number, @Param('couponId') couponId: number): Promise<UserCouponDetailResponse> {
    return await this.couponFacade.issueCoupon(couponId, userId);
  }

  @ApiOperation({ summary: '전체 쿠폰 목록 조회', description: '발급 가능한 전체 쿠폰 목록을 조회합니다.' })
  @ApiResponse({ status: 200, description: '쿠폰 목록 조회 성공', type: GetCouponsResponse })
  @Get()
  async getCoupons(@Query() query: GetCouponsRequest): Promise<GetCouponsResponse> {
    return await this.couponFacade.getCoupons(query);
  }

  @ApiOperation({
    summary: '사용자 보유 쿠폰 목록 조회',
    description: '로그인한 사용자가 보유한 쿠폰 목록을 조회합니다.',
  })
  @ApiResponse({ status: 200, description: '사용자 쿠폰 목록 조회 성공', type: GetUserCouponsResponse })
  @Get('users/me')
  async getUserCoupons(
    @UserId() userId: number,
    @Query() query: GetUserCouponsRequest,
  ): Promise<GetUserCouponsResponse> {
    return await this.couponFacade.getUserCoupons(userId, query);
  }
}
