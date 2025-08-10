# 동시성 이슈 및 DB 동시성 제어 기술 분석 보고서

## 1. 현재 서비스 시나리오 동시성 이슈 분석

### 1.1 Race Condition 식별

#### 재고 관리 Race Condition

**시나리오**: 100개 재고에 동시에 200명이 주문 시도

```typescript
// 현재 코드의 문제점 - src/product/product-option.service.ts
async deductMultipleStock(requests) {
  for (const request of requests) {
    const product = await this.repository.findOne(request.productOptionId); // 1. 재고 확인
    if (product.stock < request.quantity) {  // 2. 재고 검증
      throw new BadRequestException('재고 부족');
    }
    product.stock -= request.quantity;  // 3. 재고 차감
    await this.repository.save(product);  // 4. 저장
  }
}
```

**문제**: 1~4 단계 사이에 다른 트랜잭션이 재고를 변경할 수 있음 → **Over-selling 발생**

#### 잔액 관리 Race Condition

**시나리오**: 잔액 10,000원에 동시에 8,000원씩 2번 결제 시도

```typescript
// 현재 코드 - src/balance/balance.service.ts
async useBalance(userId: number, usedAmount: number) {
  const balance = await this.repository.findByUserId(userId);  // 1. 잔액 조회
  if (balance.amount < usedAmount) {  // 2. 잔액 검증
    throw new BadRequestException('잔액 부족');
  }
  balance.amount -= usedAmount;  // 3. 잔액 차감
  await this.repository.save(balance);  // 4. 저장
}
```

**문제**: 1~4 단계 사이에 다른 결제가 처리되면 **음수 잔액 발생 가능**

#### 쿠폰 발급 Race Condition

**시나리오**: 선착순 100명 쿠폰에 1000명이 동시 신청

```typescript
// 현재 코드 - src/coupon/coupon.service.ts
async issueCoupon(couponId: number, userId: number) {
  const coupon = await this.repository.findCouponById(couponId);  // 1. 쿠폰 조회
  if (coupon.remainingStock < 1) {  // 2. 재고 확인
    throw new BadRequestException('쿠폰 재고 부족');
  }
  await this.repository.updateCouponStock(couponId, coupon.remainingStock - 1);  // 3. 재고 차감
  await this.userCouponRepository.saveUserCoupon(/* */);  // 4. 사용자 쿠폰 생성
}
```

**문제**: 1~4 단계 사이에 다른 사용자가 쿠폰을 발급받으면 **Over-issuing 발생**

### 1.2 Deadlock 위험 시나리오

#### 주문 처리 중 Deadlock

```typescript
// 트랜잭션 A: 상품1 → 상품2 순서로 락 획득 시도
// 트랜잭션 B: 상품2 → 상품1 순서로 락 획득 시도
async pay(userId: number, request: CreateOrderRequest) {
  await this.balanceService.useBalance(userId, request.usedAmount);  // 잔액 락
  await this.productService.deductStock(request.productOptions);    // 상품 락 (순서 불일치)
  await this.couponService.useCoupon(userId, request.couponCode);   // 쿠폰 락
}
```

**위험**: 다중 상품 주문 시 상품 ID 순서가 다르면 **교착상태 발생**

---

## 2. RDBMS 동시성 제어 기술

### 2.1 DB Lock 메커니즘

#### Shared Lock (S-Lock) vs Exclusive Lock (X-Lock)

```sql
-- S-Lock: 읽기 전용, 다른 S-Lock 허용
SELECT * FROM products WHERE id = 1 LOCK IN SHARE MODE;

-- X-Lock: 읽기/쓰기 독점, 다른 모든 락 차단
SELECT * FROM products WHERE id = 1 FOR UPDATE;
```

#### 트랜잭션 격리 수준

| 격리 수준        | Dirty Read | Non-Repeatable Read | Phantom Read |
| ---------------- | ---------- | ------------------- | ------------ |
| READ UNCOMMITTED | 허용       | 허용                | 허용         |
| READ COMMITTED   | 차단       | 허용                | 허용         |
| REPEATABLE READ  | 차단       | 차단                | 허용         |
| SERIALIZABLE     | 차단       | 차단                | 차단         |

### 2.2 Pessimistic Lock vs Optimistic Lock

#### Pessimistic Lock (비관적 락)

- **특징**: 데이터 접근 시 즉시 락 획득
- **장점**: 데이터 정합성 보장, 충돌 원천 차단
- **단점**: 성능 저하, 데드락 위험
- **적용 시나리오**: 충돌 확률 높음, 데이터 정합성 중요

#### Optimistic Lock (낙관적 락)

- **특징**: 충돌이 드물다고 가정, 커밋 시점에 검증
- **장점**: 높은 동시성, 데드락 없음
- **단점**: 충돌 시 재시도 필요, 복잡한 로직
- **적용 시나리오**: 충돌 확률 낮음, 성능 중요

---

## 3. 비즈니스 로직별 최적 동시성 제어 방식

### 3.1 재고 관리 → Pessimistic Lock

**선택 이유**: 재고 부족은 비즈니스 치명적, 충돌 확률 높음

```typescript
async deductStock(productId: number, quantity: number) {
  const queryRunner = this.dataSource.createQueryRunner();
  await queryRunner.startTransaction();

  try {
    // Pessimistic Write Lock 적용
    const product = await queryRunner.manager.findOne(ProductEntity, {
      where: { id: productId },
      lock: { mode: 'pessimistic_write' }
    });

    if (product.stock < quantity) {
      throw new BadRequestException('재고 부족');
    }

    product.stock -= quantity;
    await queryRunner.manager.save(product);
    await queryRunner.commitTransaction();

  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
  }
}
```

### 3.2 잔액 관리 → Optimistic Lock

**선택 이유**: 개인별 잔액 충돌 적음, 성능 중요

```typescript
// Entity에 version 컬럼 추가
@Entity()
export class BalanceEntity {
  @VersionColumn()
  version: number;

  @Column()
  amount: number;
}

// 서비스 로직
async useBalanceWithOptimistic(userId: number, amount: number, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const balance = await this.repository.findByUserId(userId);

      if (balance.amount < amount) {
        throw new BadRequestException('잔액 부족');
      }

      balance.amount -= amount;
      await this.repository.save(balance); // version 자동 체크
      return;

    } catch (error) {
      if (error.name === 'OptimisticLockVersionMismatchError' && attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 100)); // 재시도 지연
        continue;
      }
      throw error;
    }
  }
}
```

### 3.3 쿠폰 발급 → Distributed Lock (Redis)

**선택 이유**: 선착순 특성, 높은 동시성, 단일 장애점 방지

```typescript
async issueCouponWithDistributedLock(couponId: number, userId: number) {
  const lockKey = `coupon:${couponId}:lock`;
  const lock = await this.redisClient.set(lockKey, '1', 'PX', 5000, 'NX');

  if (!lock) {
    throw new BadRequestException('쿠폰 발급 처리 중입니다. 잠시 후 다시 시도해주세요.');
  }

  try {
    const coupon = await this.repository.findCouponById(couponId);

    if (coupon.remainingStock < 1) {
      throw new BadRequestException('쿠폰이 모두 소진되었습니다.');
    }

    // 원자적 연산으로 쿠폰 발급
    await this.repository.updateCouponStock(couponId, coupon.remainingStock - 1);
    await this.userCouponRepository.saveUserCoupon({ userId, couponId });

  } finally {
    await this.redisClient.del(lockKey);
  }
}
```

### 3.4 주문 처리 → 통합 트랜잭션 vs 분산 트랜잭션

#### A) 통합 트랜잭션 방식 (현재 방식)

**특징**: 모든 작업을 하나의 트랜잭션으로 처리
**장점**: 강한 일관성, 구현 단순
**단점**: 긴 락 시간, 성능 제한

```typescript
@Transactional()
async processOrderMonolithic(userId: number, request: CreateOrderRequest) {
  // 모든 작업이 하나의 트랜잭션 내에서 실행
  const sortedProductIds = request.productOptions
    .map(p => p.productOptionId)
    .sort((a, b) => a - b);

  await this.productService.deductStockWithLock(sortedProductIds, quantities);
  await this.balanceService.useBalanceWithOptimistic(userId, request.usedAmount);
  if (request.couponCode) {
    await this.couponService.markCouponAsUsed(userId, request.couponCode);
  }
  return await this.orderService.createOrder(userId, request);
}
```

#### B) 분산 트랜잭션 방식 (확장성 고려)

### 3.5 주문 처리 → 분산 트랜잭션 패턴들

#### Saga Pattern (Orchestrator 방식)

**특징**: 각 단계를 독립적 트랜잭션으로 분리, 실패 시 보상 작업
**장점**: 높은 확장성, 서비스 독립성
**단점**: 복잡한 보상 로직, 일시적 불일치

```typescript
// 주문 오케스트레이터
@Injectable()
export class OrderSagaOrchestrator {
  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly orderRepository: IOrderRepository,
  ) {}

  async processOrderSaga(userId: number, request: CreateOrderRequest) {
    const sagaId = `order_saga_${Date.now()}_${userId}`;

    try {
      // 1단계: 재고 예약
      const stockReservation = await this.reserveStock(sagaId, request.productOptions);

      // 2단계: 잔액 차감
      const balanceDeduction = await this.deductBalance(sagaId, userId, request.usedAmount);

      // 3단계: 쿠폰 사용
      const couponUsage = request.couponCode ? await this.useCoupon(sagaId, userId, request.couponCode) : null;

      // 4단계: 주문 확정
      const order = await this.confirmOrder(sagaId, userId, request);

      // 모든 단계 성공 - 예약을 실제 차감으로 변경
      await this.commitReservations(sagaId);

      return order;
    } catch (error) {
      // 실패 시 보상 작업 실행
      await this.compensate(sagaId, error);
      throw error;
    }
  }

  private async reserveStock(sagaId: string, productOptions: any[]) {
    // 재고 예약 (실제 차감 X, 예약만)
    for (const option of productOptions) {
      await this.productService.reserveStock(sagaId, option.productOptionId, option.quantity);
    }
    return { sagaId, step: 'stock_reserved', productOptions };
  }

  private async compensate(sagaId: string, error: Error) {
    // 보상 작업: 역순으로 rollback
    await this.rollbackOrder(sagaId);
    await this.rollbackCoupon(sagaId);
    await this.rollbackBalance(sagaId);
    await this.rollbackStockReservation(sagaId);

    console.error(`Saga ${sagaId} compensated due to:`, error);
  }
}
```

#### Event-Driven 비동기 처리

**특징**: 이벤트 발행/구독으로 각 단계 비동기 처리
**장점**: 높은 성능, 확장성
**단점**: 최종 일관성, 복잡한 상태 관리

```typescript
// 이벤트 기반 주문 처리
@Injectable()
export class OrderEventHandler {
  async processOrderAsync(userId: number, request: CreateOrderRequest) {
    const orderId = await this.createPendingOrder(userId, request);

    // 비동기 이벤트 발행
    this.eventEmitter.emit('order.stock_deduction_requested', {
      orderId,
      productOptions: request.productOptions,
    });

    return { orderId, status: 'PROCESSING' };
  }

  @OnEvent('order.stock_deduction_completed')
  async handleStockDeducted(event: { orderId: string; success: boolean }) {
    if (event.success) {
      this.eventEmitter.emit('order.balance_deduction_requested', { orderId: event.orderId });
    } else {
      await this.failOrder(event.orderId, 'STOCK_INSUFFICIENT');
    }
  }

  @OnEvent('order.balance_deduction_completed')
  async handleBalanceDeducted(event: { orderId: string; success: boolean }) {
    if (event.success) {
      this.eventEmitter.emit('order.coupon_usage_requested', { orderId: event.orderId });
    } else {
      // 보상: 재고 복구
      await this.compensateStock(event.orderId);
      await this.failOrder(event.orderId, 'BALANCE_INSUFFICIENT');
    }
  }

  @OnEvent('order.all_steps_completed')
  async handleOrderCompleted(event: { orderId: string }) {
    await this.confirmOrder(event.orderId);

    // 부가 작업들 (알림, 분석 등) 비동기 처리
    this.eventEmitter.emit('order.notification_requested', { orderId: event.orderId });
    this.eventEmitter.emit('order.analytics_requested', { orderId: event.orderId });
  }
}
```

---

## 4. 핵심 구현 패턴

### 4.1 데드락 방지 패턴

```typescript
// 리소스 ID 정렬로 일관된 락 획득 순서 보장
const sortedIds = resourceIds.sort((a, b) => a - b);
for (const id of sortedIds) {
  await acquireLock(id);
}
```

### 4.2 재시도 패턴

```typescript
async function withRetry<T>(operation: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1))); // 지수 백오프
    }
  }
}
```

### 4.3 타임아웃 설정

```typescript
// PostgreSQL 락 타임아웃 설정
await queryRunner.query('SET lock_timeout = 5000'); // 5초
```

---

## 5. 결론 및 권장사항

### 5.1 비즈니스별 최적 전략

| 비즈니스 로직 | 선택 기술               | 이유                                    |
| ------------- | ----------------------- | --------------------------------------- |
| **재고 관리** | Pessimistic Lock        | 데이터 정합성 최우선, Over-selling 방지 |
| **잔액 관리** | Optimistic Lock + Retry | 개인별 충돌 적음, 성능 균형             |
| **쿠폰 발급** | Distributed Lock        | 선착순 특성, 고가용성                   |
| **주문 처리** | 통합 vs 분산 선택       | 요구사항에 따라 선택 (하단 가이드 참고) |

### 5.2 주문 처리 방식 선택 가이드

#### 통합 트랜잭션 vs 분산 트랜잭션 비교

| 항목            | 통합 트랜잭션      | Saga Pattern   | Event-Driven     |
| --------------- | ------------------ | -------------- | ---------------- |
| **일관성**      | 강한 일관성 (ACID) | 최종 일관성    | 최종 일관성      |
| **성능**        | 보통 (긴 락 시간)  | 높음           | 매우 높음        |
| **복잡도**      | 낮음               | 보통           | 높음             |
| **확장성**      | 제한적             | 높음           | 매우 높음        |
| **데드락 위험** | 있음               | 없음           | 없음             |
| **장애 복구**   | 자동 롤백          | 보상 작업 필요 | 복잡한 상태 관리 |

#### 선택 기준

**통합 트랜잭션 권장 상황:**

- 강한 데이터 일관성이 필수적인 경우
- 트랜잭션 처리량이 낮은 경우 (< 100 TPS)
- 개발 복잡도를 최소화해야 하는 경우
- 현재 프로젝트 초기 단계

**Saga Pattern 권장 상황:**

- 높은 처리량이 필요한 경우 (> 500 TPS)
- 마이크로서비스 아키텍처로 확장 계획
- 일시적 데이터 불일치를 허용할 수 있는 경우
- 서비스별 독립적 배포가 필요한 경우

**Event-Driven 권장 상황:**

- 매우 높은 확장성이 필요한 경우 (> 1000 TPS)
- 실시간 알림, 분석 등 부가 기능이 많은 경우
- 비동기 처리가 비즈니스 요구사항에 적합한 경우
- 복잡한 상태 관리를 감당할 수 있는 팀 역량

### 5.3 구현 우선순위 및 로드맵

#### Phase 1: 기본 동시성 제어 (즉시 적용)

1. **재고 관리**: Pessimistic Lock 적용
2. **잔액 관리**: Optimistic Lock + Retry 적용
3. **주문 처리**: 통합 트랜잭션 방식 유지

#### Phase 2: 고도화 및 확장성 (1-2주 내)

1. **쿠폰 발급**: Distributed Lock (Redis) 적용
2. **성능 모니터링**: 메트릭 수집 및 대시보드 구축
3. **부하 테스트**: 동시성 한계 측정

#### Phase 3: 분산 트랜잭션 도입 (필요 시)

1. **트래픽 증가 시**: Saga Pattern 도입 검토
2. **마이크로서비스 전환 시**: Event-Driven 아키텍처 적용
3. **고가용성 요구 시**: 완전 분산 처리 전환
