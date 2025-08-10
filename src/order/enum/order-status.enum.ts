// 주문 상태 enum
export enum OrderStatus {
  CONFIRMED = 'CONFIRMED', // 주문/결제 성공
  PROCESSING = 'PROCESSING', // 처리 중
  COMPLETED = 'COMPLETED', // 완료
  CANCELLED = 'CANCELLED', // 취소
  FAILED = 'FAILED', // 주문/결제 실패
}
