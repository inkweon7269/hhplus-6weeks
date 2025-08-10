// 전체 쿠폰 상태 enum
export enum CouponStatus {
  AVAILABLE = 'AVAILABLE', // 발급 가능
  SUSPENDED = 'SUSPENDED', // 발급 중단
  EXPIRED = 'EXPIRED', // 발급 기간 만료
}

// 사용자 보유 쿠폰 상태 enum
export enum UserCouponStatus {
  AVAILABLE = 'AVAILABLE', // 사용 가능
  USED = 'USED', // 사용됨
  EXPIRED = 'EXPIRED', // 만료됨
}
