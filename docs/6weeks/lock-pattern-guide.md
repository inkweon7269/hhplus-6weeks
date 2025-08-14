# 낙관적/비관적 락 입문 가이드

이 문서는 개발 입문자도 쉽게 이해할 수 있도록 락(Lock) 패턴에 대해 설명합니다. 실생활 예시와 현재 프로젝트의 실제 코드를 바탕으로 설명합니다.

## 📋 목차
1. [락이 왜 필요한가?](#락이-왜-필요한가)
2. [낙관적/비관적 락 적용 판단 기준](#낙관적비관적-락-적용-판단-기준)
3. [수정 실패 허용 가능 여부 판단](#수정-실패-허용-가능-여부-판단)
4. [락 충돌/경합 발생 시나리오](#락-충돌경합-발생-시나리오)
5. [락 선택이 성능에 미치는 영향](#락-선택이-성능에-미치는-영향)
6. [실무 적용 가이드](#실무-적용-가이드)

---

## 락이 왜 필요한가?

### 🎯 핵심 문제: 동시성 이슈
여러 사용자가 **동시에** 같은 데이터를 수정하려고 할 때 발생하는 문제들:

**🏪 편의점 상황으로 이해하기**
- 라면 1개가 남았는데, A고객과 B고객이 동시에 집어감
- 둘 다 "아직 1개 있네!"라고 생각하고 계산대로 향함
- 결과: 실제로는 0개인데 시스템상 -1개 (말이 안 되는 상황!)

**현재 프로젝트에서 발생할 수 있는 문제들:**
```typescript
// 현재 Balance 엔티티 - 낙관적 락 적용됨
@Entity('balances')
export class BalanceEntity {
  @Column({ type: 'int', comment: '잔액' })
  amount: number;

  @VersionColumn({ comment: '낙관적 락을 위한 버전 컬럼' })
  version: number; // 🎯 이것이 핵심!
}
```

---

## 낙관적/비관적 락 적용 판단 기준

### 🤔 두 가지 접근 철학

#### 낙관적 락 (Optimistic Lock): "충돌은 별로 없을 거야"
**🎫 콘서트 티켓 예매 방식**
- 여러 명이 동시에 같은 좌석을 선택할 수 있음
- 결제 시점에 "아직 이 좌석이 비어있나?" 확인
- 다른 사람이 먼저 샀다면 "이미 판매된 좌석입니다" 메시지

```typescript
// 현재 프로젝트의 낙관적 락 적용 예시
async updateBalance(userId: number, amount: number) {
  // 1. 버전 정보와 함께 조회
  const balance = await this.balanceRepository.findByUserId(userId);
  
  // 2. 잔액 수정
  balance.amount += amount;
  
  // 3. 저장 시 버전 체크 (TypeORM이 자동 처리)
  // 만약 다른 요청이 먼저 수정했다면 OptimisticLockVersionMismatchError 발생
  return await this.balanceRepository.save(balance);
}
```

#### 비관적 락 (Pessimistic Lock): "충돌이 자주 일어날 거야"
**🚗 주차장 관리 방식**
- 주차 공간에 미리 콘을 세워놓기
- 내가 주차할 때까지 다른 차는 접근 불가
- 확실히 자리를 보장받지만, 다른 차들은 기다려야 함

```typescript
// 비관적 락 적용 예시
async updateBalanceWithLock(userId: number, amount: number) {
  const queryRunner = this.dataSource.createQueryRunner();
  await queryRunner.startTransaction();
  
  try {
    // 1. 즉시 락 걸고 조회 (다른 트랜잭션은 대기)
    const balance = await queryRunner.manager.findOne(BalanceEntity, {
      where: { userId },
      lock: { mode: 'pessimistic_write' } // 🔒 여기서 락!
    });
    
    // 2. 안전하게 수정 (다른 요청은 기다리는 중)
    balance.amount += amount;
    await queryRunner.manager.save(balance);
    
    await queryRunner.commitTransaction();
  } finally {
    await queryRunner.release(); // 🔓 락 해제
  }
}
```

### 📊 판단 기준 매트릭스

| 기준 | 낙관적 락 선택 | 비관적 락 선택 |
|------|---------------|---------------|
| **충돌 빈도** | 낮음 (< 5%) | 높음 (> 20%) |
| **동시 사용자 수** | 적음-보통 (< 100명) | 많음 (> 100명) |
| **데이터 중요도** | 보통 (프로필, 설정) | 높음 (금액, 재고) |
| **응답 시간 요구** | 빠름 (< 100ms) | 보통 (< 500ms) |
| **재시도 가능성** | 허용 가능 | 허용 어려움 |

### 🎯 현재 프로젝트 적용 예시

**낙관적 락이 적합한 경우:**
```typescript
// ✅ 사용자 프로필 수정 - 충돌이 거의 없음
async updateUserProfile(userId: number, profileData: any) {
  // 한 사용자가 동시에 프로필을 수정할 확률은 매우 낮음
}

// ✅ 쿠폰 사용 - 한 사용자가 같은 쿠폰을 동시에 사용할 확률 낮음  
async useCoupon(userId: number, couponId: number) {
  // 재시도가 가능하고, 실패해도 큰 문제없음
}
```

**비관적 락이 적합한 경우:**
```typescript
// ⚠️ 한정 수량 쿠폰 발급 - 동시 접속이 많고 충돌 빈도 높음
async issueLimitedCoupon(couponId: number, userId: number) {
  // 100명이 동시에 마지막 1개 쿠폰을 받으려고 시도
}

// ⚠️ 실시간 재고 차감 - 인기 상품의 경우 충돌 빈도 매우 높음
async deductStock(productId: number, quantity: number) {
  // 플래시 세일, 한정판 상품 등
}
```

---

## 수정 실패 허용 가능 여부 판단

### 🎯 비즈니스 임계도에 따른 분류

#### 🟢 실패 허용 가능 (Low Critical)
**특징**: 재시도 가능, 사용자 경험에 큰 영향 없음

```typescript
// 예시 1: 사용자 설정 변경
async updateUserSettings(userId: number, settings: UserSettings) {
  try {
    return await this.userService.updateSettings(userId, settings);
  } catch (OptimisticLockError) {
    // 🔄 간단한 재시도
    return await this.userService.updateSettings(userId, settings);
  }
}

// 예시 2: 비실시간 통계 업데이트
async updateViewCount(postId: number) {
  // 실패해도 큰 문제없음, 나중에 배치로 처리 가능
}
```

#### 🟡 제한적 실패 허용 (Medium Critical)  
**특징**: 몇 번의 재시도는 허용, 최종 실패 시 대안 제공

```typescript
// 예시: 일반 상품 주문
async createOrder(orderData: CreateOrderRequest) {
  const maxRetries = 3;
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      return await this.orderService.processOrder(orderData);
    } catch (OptimisticLockError) {
      attempt++;
      if (attempt >= maxRetries) {
        // 🎯 최종 실패 시 대안 제공
        throw new ConflictException(
          '주문이 지연되고 있습니다. 잠시 후 다시 시도해주세요.'
        );
      }
      // 지수 백오프로 재시도
      await this.delay(100 * Math.pow(2, attempt));
    }
  }
}
```

#### 🔴 실패 불허용 (High Critical)
**특징**: 무조건 성공해야 함, 비즈니스 손실 직결

```typescript
// 예시 1: 결제 처리
async processPayment(paymentData: PaymentRequest) {
  // 💰 돈과 관련된 작업은 무조건 성공해야 함
  const lockKey = `payment:${paymentData.userId}`;
  
  return await this.distributedLockService.withLock(lockKey, async () => {
    // 비관적 락으로 확실하게 보장
    return await this.paymentService.processPayment(paymentData);
  });
}

// 예시 2: 한정 수량 이벤트
async issueEventReward(eventId: number, userId: number) {
  // 🎁 선착순 100명 같은 경우 정확성이 생명
  // 비관적 락 + 분산 락 조합 사용
}
```

### 📋 실패 허용도 체크리스트

| 질문 | 답변 | 권장 방식 |
|------|------|----------|
| 실패 시 비즈니스 손실이 있나? | 있음 | 비관적 락 |
| 사용자가 재시도를 기다릴 수 있나? | 없음 | 비관적 락 |
| 실시간 처리가 필요한가? | 필요함 | 비관적 락 |
| 충돌 시 데이터 무결성이 깨지나? | 깨짐 | 비관적 락 |
| 모든 답이 "그렇지 않음" | - | 낙관적 락 |

---

## 락 충돌/경합 발생 시나리오

### 🎭 시나리오 1: 잔액 이중 차감 (Race Condition)

**상황**: 사용자 A의 잔액이 10,000원인데 동시에 두 번의 주문

```
👤 사용자 A (잔액: 10,000원)
     ↓
┌─────────────┐           ┌─────────────┐
│   주문 1    │           │   주문 2    │
│  (7,000원)  │           │  (5,000원)  │
└─────────────┘           └─────────────┘
```

#### 💥 문제 상황 (락 없이)
| 시간 | 주문 1 (7,000원) | 주문 2 (5,000원) | 실제 잔액 |
|------|-----------------|-----------------|---------|
| T1   | 잔액 조회: 10,000원 | 잔액 조회: 10,000원 | 10,000원 |
| T2   | 검증: OK ✅ | 검증: OK ✅ | 10,000원 |
| T3   | 잔액 차감: 3,000원 | 잔액 차감: 5,000원 | **-2,000원** 💥 |

**결과**: 실제 사용한 금액은 12,000원인데 잔액은 -2,000원! 

#### ✅ 해결 방법 1: 낙관적 락
```typescript
async useBalance(userId: number, amount: number) {
  const maxRetries = 3;
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      const balance = await this.balanceRepository.findByUserId(userId);
      
      if (balance.amount < amount) {
        throw new BadRequestException('잔액이 부족합니다');
      }
      
      balance.amount -= amount;
      return await this.balanceRepository.save(balance); // 버전 체크
      
    } catch (OptimisticLockVersionMismatchError) {
      attempt++;
      if (attempt >= maxRetries) {
        throw new ConflictException('잠시 후 다시 시도해주세요');
      }
      await this.delay(50 * attempt); // 재시도 간격
    }
  }
}
```

**시나리오 결과 (낙관적 락)**:
| 시간 | 주문 1 (7,000원) | 주문 2 (5,000원) | 실제 잔액 |
|------|-----------------|-----------------|---------|
| T1   | 잔액 조회: 10,000원 (v1) | 잔액 조회: 10,000원 (v1) | 10,000원 |
| T2   | 차감 성공: 3,000원 (v2) | 버전 체크 실패! ❌ | 3,000원 |
| T3   | - | 다시 조회: 3,000원 (v2) | 3,000원 |
| T4   | - | 잔액 부족 에러! ❌ | 3,000원 |

#### ✅ 해결 방법 2: 비관적 락  
```typescript
async useBalanceWithLock(userId: number, amount: number) {
  return await this.dataSource.transaction(async (manager) => {
    // 즉시 락 획득
    const balance = await manager.findOne(BalanceEntity, {
      where: { userId },
      lock: { mode: 'pessimistic_write' }
    });
    
    if (balance.amount < amount) {
      throw new BadRequestException('잔액이 부족합니다');
    }
    
    balance.amount -= amount;
    return await manager.save(balance);
  });
}
```

**시나리오 결과 (비관적 락)**:
| 시간 | 주문 1 (7,000원) | 주문 2 (5,000원) | 실제 잔액 |
|------|-----------------|-----------------|---------|
| T1   | 잔액 락 획득 🔒 | 락 대기... ⏳ | 10,000원 |
| T2   | 차감 완료: 3,000원 | 락 대기... ⏳ | 3,000원 |
| T3   | 락 해제 🔓 | 잔액 락 획득 🔒 | 3,000원 |
| T4   | - | 잔액 부족 에러! ❌ | 3,000원 |

### 🎭 시나리오 2: 쿠폰 중복 발급 (First-Come-First-Served)

**상황**: 선착순 쿠폰 1개 남음, 1000명이 동시 요청

```
🎫 한정 쿠폰 (남은 수량: 1개)
        ↓
👥👥👥 ... 👥👥👥 (1000명 동시 요청)
```

#### 💥 문제 상황 (락 없이)
```typescript
// 위험한 코드
async issueCoupon(couponId: number, userId: number) {
  // 1. 쿠폰 정보 조회
  const coupon = await this.couponRepository.findById(couponId);
  
  // 2. 수량 확인 (1000명이 모두 "1개 있네!" 확인)
  if (coupon.remainingStock < 1) {
    throw new Error('쿠폰이 소진되었습니다');
  }
  
  // 🕐 여기서 시간 지연...
  
  // 3. 쿠폰 차감 (1000명이 모두 차감 시도!)
  coupon.remainingStock -= 1;
  await this.couponRepository.save(coupon);
  
  // 4. 사용자 쿠폰 생성
  return await this.userCouponRepository.createUserCoupon(userId, couponId);
}
```

**결과**: 1개만 있었는데 1000개가 발급됨! 💥

#### ✅ 해결 방법: 분산 락 + 비관적 락 조합
```typescript
async issueLimitedCoupon(couponId: number, userId: number) {
  // 1단계: 분산 락으로 전역 제어
  const distributedLockKey = `coupon:${couponId}:issue`;
  
  return await this.distributedLockService.withLock(
    distributedLockKey, 
    async () => {
      // 2단계: 데이터베이스 비관적 락
      return await this.dataSource.transaction(async (manager) => {
        const coupon = await manager.findOne(CouponEntity, {
          where: { id: couponId },
          lock: { mode: 'pessimistic_write' }
        });
        
        if (coupon.remainingStock < 1) {
          throw new BadRequestException('쿠폰이 모두 소진되었습니다');
        }
        
        // 중복 발급 체크
        const existing = await manager.findOne(UserCouponEntity, {
          where: { couponId, userId }
        });
        
        if (existing) {
          throw new BadRequestException('이미 발급받은 쿠폰입니다');
        }
        
        // 원자적 처리
        coupon.remainingStock -= 1;
        await manager.save(coupon);
        
        return await manager.save(manager.create(UserCouponEntity, {
          userId,
          couponId,
          issuedAt: new Date()
        }));
      });
    },
    { timeout: 5000 } // 5초 타임아웃
  );
}
```

### 🎭 시나리오 3: 데드락 (Deadlock) 상황

**상황**: 두 주문이 서로 다른 순서로 상품에 접근

```
주문 A: 상품1 → 상품2
주문 B: 상품2 → 상품1
```

#### 💥 데드락 발생 과정
| 시간 | 주문 A | 주문 B | 상태 |
|------|--------|--------|------|
| T1   | 상품1 락 획득 🔒 | 상품2 락 획득 🔒 | 진행 중 |
| T2   | 상품2 락 대기 ⏳ | 상품1 락 대기 ⏳ | **데드락!** 💥 |

#### ✅ 해결 방법: 락 순서 통일
```typescript
async processMultipleProducts(productIds: number[]) {
  // 🎯 핵심: 항상 같은 순서로 락 획득
  const sortedProductIds = productIds.sort((a, b) => a - b);
  
  return await this.dataSource.transaction(async (manager) => {
    const products = [];
    
    // 정렬된 순서대로 락 획득
    for (const productId of sortedProductIds) {
      const product = await manager.findOne(ProductEntity, {
        where: { id: productId },
        lock: { mode: 'pessimistic_write' }
      });
      products.push(product);
    }
    
    // 안전하게 처리
    return await this.processProducts(manager, products);
  });
}
```

---

## 락 선택이 성능에 미치는 영향

### 📊 성능 비교표

| 성능 지표 | 낙관적 락 | 비관적 락 | 분산 락 |
|-----------|-----------|-----------|---------|
| **처리량** (TPS) | 높음 (1000+) | 중간 (200-500) | 낮음 (50-200) |
| **응답시간** | 빠름 (10-50ms) | 보통 (50-200ms) | 느림 (100-500ms) |
| **메모리 사용량** | 낮음 | 중간 | 높음 |
| **확장성** | 우수 | 제한적 | 우수 |
| **복잡성** | 낮음 | 중간 | 높음 |

### 🚀 트래픽 규모별 권장 패턴

#### 소규모 서비스 (동시 사용자 < 100명)
```typescript
// ✅ 낙관적 락으로 충분
@VersionColumn()
version: number;
```
- **이유**: 충돌 확률이 낮아 성능상 이점이 큼
- **모니터링**: 충돌률 < 5% 유지

#### 중규모 서비스 (동시 사용자 100-1000명)  
```typescript
// ✅ 하이브리드 접근: 상황별 선택
// 일반 데이터: 낙관적 락
// 중요 데이터: 비관적 락

async updateBalance(userId: number, amount: number) {
  if (amount > 100000) { // 큰 금액은 비관적 락
    return await this.updateWithPessimisticLock(userId, amount);
  } else { // 작은 금액은 낙관적 락
    return await this.updateWithOptimisticLock(userId, amount);
  }
}
```

#### 대규모 서비스 (동시 사용자 > 1000명)
```typescript
// ✅ 분산 락 + 비관적 락 조합
async processHighVolumeOperation(data: any) {
  // 1차: 분산 락으로 전역 제어
  const globalLockKey = `operation:${data.key}`;
  
  return await this.distributedLockService.withLock(globalLockKey, async () => {
    // 2차: 로컬 비관적 락으로 정확성 보장
    return await this.processWithLocalLock(data);
  });
}
```

### 📈 성능 최적화 전략

#### 1. 락 타임아웃 설정
```typescript
// ⚠️ 잘못된 예: 타임아웃 없음
await manager.findOne(Product, {
  where: { id },
  lock: { mode: 'pessimistic_write' } // 무한 대기 위험!
});

// ✅ 올바른 예: 적절한 타임아웃
await manager.findOne(Product, {
  where: { id },
  lock: { mode: 'pessimistic_write', timeout: 3000 } // 3초 타임아웃
});
```

#### 2. 락 범위 최소화
```typescript
// ⚠️ 잘못된 예: 불필요한 락
async updateUser(userId: number, data: UserData) {
  return await this.dataSource.transaction(async (manager) => {
    // 전체 사용자 테이블을 락 걸 필요 없음!
    const user = await manager.findOne(User, {
      where: { id: userId },
      lock: { mode: 'pessimistic_write' }
    });
    
    // 프로필 사진 URL만 바꾸는데 모든 컬럼을 락?
    user.profileImage = data.profileImage;
    return await manager.save(user);
  });
}

// ✅ 올바른 예: 필요한 부분만 락
async updateUserBalance(userId: number, amount: number) {
  // 잔액만 락, 다른 사용자 정보는 영향 없음
  return await this.balanceService.updateWithLock(userId, amount);
}
```

#### 3. 재시도 전략 최적화
```typescript
// ✅ 지수 백오프 재시도
async optimisticUpdate(data: any) {
  const maxRetries = 3;
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      return await this.performUpdate(data);
    } catch (OptimisticLockError) {
      attempt++;
      
      if (attempt >= maxRetries) {
        throw new ConflictException('업데이트에 실패했습니다');
      }
      
      // 지수 백오프: 50ms → 100ms → 200ms
      const delay = 50 * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

### 📊 모니터링 지표

#### 1. 성능 지표
```typescript
// 응답 시간 측정
@Injectable()
export class PerformanceMonitor {
  async measureLockPerformance<T>(
    operation: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const start = Date.now();
    
    try {
      const result = await fn();
      const duration = Date.now() - start;
      
      // 메트릭 수집
      this.metricsService.recordDuration(operation, duration);
      
      if (duration > 1000) { // 1초 이상 시 경고
        this.logger.warn(`Slow lock operation: ${operation} took ${duration}ms`);
      }
      
      return result;
    } catch (error) {
      this.metricsService.recordError(operation, error);
      throw error;
    }
  }
}
```

#### 2. 알림 임계값
```typescript
// 성능 알림 설정
const PERFORMANCE_THRESHOLDS = {
  optimisticLock: {
    conflictRate: 0.05,      // 충돌률 5% 초과 시 알림
    avgResponseTime: 100     // 평균 응답시간 100ms 초과 시 알림
  },
  pessimisticLock: {
    waitTime: 1000,          // 대기시간 1초 초과 시 알림
    deadlockRate: 0.01       // 데드락률 1% 초과 시 알림
  },
  distributedLock: {
    acquisitionTime: 2000,   // 락 획득 시간 2초 초과 시 알림
    failureRate: 0.02        // 락 획득 실패율 2% 초과 시 알림
  }
};
```

---

## 실무 적용 가이드

### 🎯 프로젝트별 적용 전략

#### 현재 e-커머스 프로젝트 분석
```typescript
// 이미 잘 적용된 부분: Balance Entity
@Entity('balances')
export class BalanceEntity {
  @VersionColumn() // ✅ 낙관적 락 적용
  version: number;
  
  @Column({ type: 'int' })
  amount: number;
}
```

#### 개선이 필요한 부분

**1. 쿠폰 발급 시스템**
```typescript
// 현재 상태: 동시성 제어 부족
// 개선 방안: 분산 락 + 비관적 락 조합

@Injectable()
export class CouponService {
  async issueCoupon(couponId: number, userId: number) {
    // 🎯 여기에 락 패턴 적용 필요
    const lockKey = `coupon:${couponId}:issue`;
    
    return await this.distributedLockService.withLock(lockKey, async () => {
      return await this.dataSource.transaction(async (manager) => {
        const coupon = await manager.findOne(CouponEntity, {
          where: { id: couponId },
          lock: { mode: 'pessimistic_write' }
        });
        
        // 안전한 쿠폰 발급 로직
        return await this.processIssuance(manager, coupon, userId);
      });
    });
  }
}
```

**2. 재고 관리 시스템**
```typescript
// 개선 방안: 상품별 락 전략 차별화

@Injectable() 
export class ProductService {
  async deductStock(productId: number, quantity: number) {
    const product = await this.productRepository.findById(productId);
    
    if (product.isPopular) {
      // 인기 상품: 비관적 락
      return await this.deductWithPessimisticLock(productId, quantity);
    } else {
      // 일반 상품: 낙관적 락  
      return await this.deductWithOptimisticLock(productId, quantity);
    }
  }
}
```

### 📋 단계별 도입 가이드

#### Phase 1: 현재 상태 분석
1. **충돌 지점 식별**
   ```bash
   # 로그 분석으로 동시성 이슈 발견
   grep "OptimisticLockVersionMismatchError" logs/app.log
   grep "deadlock" logs/database.log
   ```

2. **성능 기준선 측정**
   ```typescript
   // 현재 성능 측정
   const metrics = await this.performanceService.measureCurrentState();
   ```

#### Phase 2: 점진적 적용
1. **가장 중요한 부분부터 적용**
   - 결제/잔액 시스템 (이미 적용됨 ✅)
   - 재고 관리 시스템
   - 쿠폰 발급 시스템

2. **A/B 테스트로 검증**
   ```typescript
   // 50% 트래픽에만 새로운 락 패턴 적용
   if (this.featureFlag.isEnabled('new_lock_pattern', userId)) {
     return await this.newLockService.process(data);
   } else {
     return await this.legacyService.process(data);
   }
   ```

#### Phase 3: 모니터링 및 최적화  
1. **실시간 모니터링 도입**
   ```typescript
   @Injectable()
   export class LockMonitoringService {
     async trackLockMetrics() {
       // 충돌률, 응답시간, 처리량 모니터링
       const metrics = {
         conflictRate: await this.calculateConflictRate(),
         avgResponseTime: await this.calculateAvgResponseTime(),
         throughput: await this.calculateThroughput()
       };
       
       await this.alertingService.checkThresholds(metrics);
     }
   }
   ```

2. **지속적 개선**
   - 성능 데이터 기반 튜닝
   - 트래픽 패턴 변화에 따른 전략 조정
   - 새로운 락 패턴 도입 검토

### 🚨 주의사항 및 트러블슈팅

#### 1. 흔한 실수들
```typescript
// ❌ 실수 1: 트랜잭션 밖에서 락 사용
const user = await this.repository.findOne(User, {
  where: { id },
  lock: { mode: 'pessimistic_write' } // 트랜잭션 없으면 의미없음!
});

// ✅ 올바른 방법
await this.dataSource.transaction(async (manager) => {
  const user = await manager.findOne(User, {
    where: { id },
    lock: { mode: 'pessimistic_write' } // 트랜잭션 안에서 락
  });
});

// ❌ 실수 2: 재시도 시 지연 없음
while (retries < maxRetries) {
  try {
    return await this.updateData(data);
  } catch (OptimisticLockError) {
    retries++;
    // 즉시 재시도 → 계속 충돌 발생!
  }
}

// ✅ 올바른 방법: 지연과 함께 재시도
while (retries < maxRetries) {
  try {
    return await this.updateData(data);
  } catch (OptimisticLockError) {
    retries++;
    await this.delay(100 * retries); // 점진적 지연
  }
}
```

#### 2. 응급 상황 대응
```typescript
// 🚨 락 때문에 서비스 장애 시 긴급 조치
@Injectable()
export class EmergencyService {
  async bypassLockInEmergency(operation: string) {
    if (this.configService.get('EMERGENCY_MODE') === 'true') {
      // 긴급 시 락 없이 처리 (데이터 정합성 위험 감수)
      this.logger.warn(`Emergency bypass: ${operation}`);
      return await this.processWithoutLock();
    }
    
    return await this.processWithLock();
  }
}
```

### 📚 추가 학습 리소스

1. **동시성 테스트 작성법**
   - `Promise.all()`을 이용한 동시 요청 시뮬레이션
   - TestContainers로 실제 DB 환경 테스트

2. **모니터링 도구 활용**
   - APM 도구로 락 대기 시간 측정
   - 데이터베이스 성능 모니터링

3. **고급 패턴 학습**
   - Saga 패턴으로 분산 트랜잭션 관리
   - Event Sourcing과 CQRS 패턴

---

이 가이드를 바탕으로 프로젝트의 동시성 이슈를 단계적으로 해결하고, 안정적인 서비스를 구축하시기 바랍니다! 🚀