# 동시성 이슈 분석 및 해결 가이드

## 📋 목차
1. [동시성 이슈란?](#동시성-이슈란)
2. [우리 시스템의 동시성 문제점](#우리-시스템의-동시성-문제점)
3. [실제 문제 시나리오](#실제-문제-시나리오)
4. [해결 방법](#해결-방법)
5. [구현 가이드](#구현-가이드)

---

## 🤔 동시성 이슈란?

### 기본 개념
**동시성 이슈**는 여러 사용자나 프로세스가 **동시에** 같은 데이터를 수정하려고 할 때 발생하는 문제입니다.

### 일상 예시로 이해하기
**🏪 편의점 상황**
- 라면 1개가 남아있는데, A고객과 B고객이 동시에 가져가려고 함
- 둘 다 "아직 1개 있네!"라고 생각하고 가져감
- 결과: 실제로는 0개인데 -1개가 됨 (말이 안 되는 상황!)

**💰 ATM 상황**
- 잔액이 1만원인데, 같은 시간에 5천원씩 2번 출금
- 둘 다 "잔액이 충분하네!"라고 판단
- 결과: 실제로는 -5천원 (잔액 부족인데 출금됨!)

---

## 🚨 우리 시스템의 동시성 문제점

### 1. 주문 결제 프로세스 (`OrderFacade.pay`)
**위험도: 🔥🔥🔥 매우 높음**

```typescript
// 현재 위험한 코드 흐름
async pay(userId: number, request: CreateOrderRequest) {
  // ⚠️ 문제: 각 단계가 독립적으로 실행됨
  await this.balanceService.useBalance(userId, amount);     // 1단계
  await this.productOptionService.deductMultipleStock(...); // 2단계  
  await this.couponService.useCoupon(userId, couponCode);   // 3단계
}
```

**문제점:**
- 여러 사용자가 동시에 주문하면 각 단계에서 Race Condition 발생
- 트랜잭션으로 감싸져 있지만 내부 로직이 원자적이지 않음

### 2. 잔액 관리 (`BalanceService.useBalance`)
**위험도: 🔥🔥🔥 매우 높음**

```typescript
// 현재 위험한 코드
async useBalance(userId: number, usedAmount: number) {
  const balance = await this.repository.findByUserId(userId);    // 1. 조회
  
  if (balance.amount < usedAmount) {                             // 2. 검증
    throw new Error('잔액 부족');
  }
  
  // ⚠️ 여기서 다른 요청이 잔액을 변경할 수 있음!
  
  return this.repository.deductBalance(balance, usedAmount);     // 3. 차감
}
```

**문제점:**
- **Read → Check → Modify** 패턴에서 Lost Update 발생
- 조회와 수정 사이에 다른 트랜잭션이 값을 변경할 수 있음

### 3. 재고 관리 (`ProductOptionService.deductMultipleStock`)
**위험도: 🔥🔥🔥 매우 높음**

```typescript
// 현재 위험한 코드
async deductMultipleStock(items) {
  const products = await this.repository.findByIds(ids);        // 1. 조회
  this.checkStockAvailability(items, products);                // 2. 검증
  
  // ⚠️ 여기서 다른 요청이 재고를 변경할 수 있음!
  
  for (const item of items) {
    product.stock -= item.quantity;                            // 3. 수정
  }
  await this.repository.saveMultipleStock(products);           // 4. 저장
}
```

**문제점:**
- 재고 확인과 차감 사이의 시간 간격에서 Race Condition
- 음수 재고 발생 가능

### 4. 쿠폰 발급 (`CouponService.issueCoupon`)
**위험도: 🔥🔥 높음**

```typescript
// 현재 위험한 코드
async issueCoupon(couponId: number, userId: number) {
  const coupon = await this.repository.findCouponById(couponId);  // 1. 조회
  
  if (coupon.remainingStock < 1) {                               // 2. 검증
    throw new Error('쿠폰 재고 부족');
  }
  
  // ⚠️ 여기서 다른 사용자가 같은 쿠폰을 발급받을 수 있음!
  
  await this.repository.updateCouponStock(                      // 3. 재고 감소
    couponId, 
    coupon.remainingStock - 1
  );
  
  return this.userCouponRepository.save({...});                 // 4. 사용자 쿠폰 생성
}
```

**문제점:**
- First-come-first-served 쿠폰에서 중복 발급 가능
- 쿠폰 재고보다 많은 발급 가능

---

## 📖 실제 문제 시나리오

### 시나리오 1: 잔액 중복 차감
**상황**: 사용자 A의 잔액이 10,000원

| 시간 | 요청 1 (5,000원 주문) | 요청 2 (7,000원 주문) |
|------|---------------------|---------------------|
| T1   | 잔액 조회: 10,000원 | 잔액 조회: 10,000원 |
| T2   | 검증: OK (10,000 ≥ 5,000) | 검증: OK (10,000 ≥ 7,000) |
| T3   | 잔액 차감: 5,000원 | 잔액 차감: 3,000원 |

**결과**: 실제 사용한 금액은 12,000원인데 잔액은 3,000원 → **음수 잔액 발생!**

### 시나리오 2: 재고 초과 판매
**상황**: 상품 A의 재고가 1개

| 시간 | 주문 1 (1개) | 주문 2 (1개) |
|------|-------------|-------------|
| T1   | 재고 조회: 1개 | 재고 조회: 1개 |
| T2   | 검증: OK (1 ≥ 1) | 검증: OK (1 ≥ 1) |
| T3   | 재고 차감: 0개 | 재고 차감: -1개 |

**결과**: 실제로는 2개가 판매되었는데 재고는 -1개 → **음수 재고 발생!**

### 시나리오 3: 쿠폰 중복 발급
**상황**: 선착순 쿠폰 1개 남음

| 시간 | 사용자 A | 사용자 B |
|------|----------|----------|
| T1   | 쿠폰 재고 조회: 1개 | 쿠폰 재고 조회: 1개 |
| T2   | 검증: OK (1 ≥ 1) | 검증: OK (1 ≥ 1) |
| T3   | 쿠폰 재고: 0개 | 쿠폰 재고: -1개 |
| T4   | 사용자 쿠폰 생성 ✅ | 사용자 쿠폰 생성 ✅ |

**결과**: 1개만 있었는데 2명이 받음 → **중복 발급!**

### 시나리오 4: Deadlock 상황
**상황**: 두 사용자가 서로 다른 순서로 리소스 접근

| 시간 | 사용자 A (쿠폰1 + 상품1) | 사용자 B (상품1 + 쿠폰1) |
|------|------------------------|------------------------|
| T1   | 쿠폰1 Lock 획득 🔒 | 상품1 Lock 획득 🔒 |
| T2   | 상품1 Lock 대기 ⏳ | 쿠폰1 Lock 대기 ⏳ |

**결과**: 서로 상대방이 가진 Lock을 기다리며 **무한 대기!**

---

---

## 💡 DB 동시성 제어 기술

### 1. Transaction Isolation Level
**개념**: 트랜잭션 간의 격리 수준을 정의하여 동시성과 일관성의 균형을 조절

**🏢 회사 회의실 예시로 이해하기:**
- 회의실(데이터)을 여러 팀(트랜잭션)이 사용하려 할 때, 어느 정도까지 공유할지 결정하는 규칙

| 격리 수준 | 설명 | 회의실 비유 | 발생 가능한 문제 | 성능 |
|-----------|------|-------------|----------------|------|
| **READ UNCOMMITTED** | 커밋되지 않은 데이터도 읽기 가능 | 회의 중에도 다른 팀이 들어와서 자료 훔쳐보기 | Dirty Read, Non-repeatable Read, Phantom Read | ⭐⭐⭐⭐ |
| **READ COMMITTED** | 커밋된 데이터만 읽기 가능 (기본값) | 회의 끝나면 자료 보기 가능 | Non-repeatable Read, Phantom Read | ⭐⭐⭐ |
| **REPEATABLE READ** | 같은 트랜잭션 내에서 일관된 읽기 보장 | 내 회의 시간 동안은 자료가 바뀌지 않음 | Phantom Read | ⭐⭐ |
| **SERIALIZABLE** | 모든 트랜잭션을 직렬화하여 실행 | 한 번에 한 팀만 회의실 사용 | 없음 | ⭐ |

**🏪 편의점 예시:**
- READ UNCOMMITTED: 계산대에서 계산 중인 물건도 다른 고객이 볼 수 있음
- READ COMMITTED: 계산 완료된 영수증만 다른 고객이 볼 수 있음
- REPEATABLE READ: 내가 쇼핑하는 동안 가격표가 바뀌지 않음
- SERIALIZABLE: 한 번에 한 고객만 쇼핑 가능

**예시**:
```sql
-- 트랜잭션 격리 수준 설정
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
```

### 2. Database Lock 메커니즘

**📚 도서관 예시로 이해하기:**
- 도서관의 책(데이터)을 여러 사람(트랜잭션)이 사용하려 할 때의 규칙

#### S-Lock (Shared Lock) - 공유 락
**개념**: 데이터를 읽기 위한 락, 여러 트랜잭션이 동시에 획득 가능

**📖 도서관 읽기석 비유:**
- 같은 책을 여러 명이 동시에 읽을 수 있음
- 하지만 누군가 읽고 있으면 그 책에 낙서하거나 찢을 수 없음
- 읽기만 하고 수정은 불가능

**특징**:
- 읽기 작업에 사용
- 여러 트랜잭션이 동시에 S-Lock 획득 가능
- S-Lock이 걸린 데이터는 읽기만 가능, 쓰기 불가

**실생활 예시**: 
- 여러 사람이 동시에 같은 메뉴판을 볼 수 있지만, 누군가 보고 있으면 메뉴를 수정할 수 없음

**예시**:
```sql
-- PostgreSQL에서 공유 락 설정
SELECT * FROM products WHERE id = 1 FOR SHARE;
```

#### X-Lock (Exclusive Lock) - 배타적 락
**개념**: 데이터를 수정하기 위한 락, 한 번에 하나의 트랜잭션만 획득 가능

**✏️ 도서관 대출 비유:**
- 책을 대출하면 그 책은 나만 가질 수 있음
- 다른 사람은 내가 반납할 때까지 읽을 수도 대출할 수도 없음
- 나는 책을 읽고, 메모도 하고, 수정도 할 수 있음

**특징**:
- 쓰기 작업에 사용  
- 한 트랜잭션만 X-Lock 획득 가능
- X-Lock이 걸린 데이터는 다른 트랜잭션이 읽기/쓰기 모두 불가

**실생활 예시**: 
- 화장실을 사용할 때 문을 잠그면, 다른 사람은 들어올 수도 없고 볼 수도 없음

**Lock 호환성 표**:
| 현재 Lock | 요청 Lock | 결과 |
|-----------|-----------|------|
| 없음 | S-Lock | ✅ 허용 |
| 없음 | X-Lock | ✅ 허용 |
| S-Lock | S-Lock | ✅ 허용 (여러 명이 읽기 가능) |
| S-Lock | X-Lock | ❌ 대기 (읽는 중에는 수정 불가) |
| X-Lock | S-Lock | ❌ 대기 (수정 중에는 읽기 불가) |
| X-Lock | X-Lock | ❌ 대기 (수정 중에는 수정 불가) |

**예시**:
```sql
-- PostgreSQL에서 배타적 락 설정
SELECT * FROM products WHERE id = 1 FOR UPDATE;
```

### 3. Optimistic Lock vs Pessimistic Lock

**🎯 두 가지 접근 철학:**
- **비관적**: "분명히 충돌할 거야, 미리 막자!"
- **낙관적**: "충돌은 별로 없을 거야, 일단 해보자!"

#### Pessimistic Lock (비관적 락킹)
**개념**: "충돌이 발생할 것이다"라고 가정하고 미리 데이터에 락을 걸어 다른 트랜잭션의 접근을 차단

**🚗 주차장 예시:**
- 주차 공간에 미리 콘을 세워놓기
- 내가 주차할 때까지 다른 차는 접근 불가
- 확실히 자리를 보장받지만, 다른 차들은 기다려야 함

**🍕 피자 주문 예시:**
- 피자집에서 "이 피자는 제가 예약했습니다" 스티커를 미리 붙임
- 다른 고객은 그 피자를 볼 수도 주문할 수도 없음
- 내가 결제 완료할 때까지 완전히 독점

**동작 방식**:
1. 데이터 조회 시 즉시 락 획득 (콘 설치)
2. 트랜잭션 완료까지 락 유지 (콘 유지)
3. 다른 트랜잭션은 락이 해제될 때까지 대기 (다른 차 대기)

**장점**:
- 확실한 동시성 제어 (100% 보장)
- 데이터 무결성 보장
- 충돌 발생 시 즉시 감지

**단점**:
- 성능 저하 (대기 시간 발생)
- Deadlock 발생 가능성 (서로 기다리는 상황)
- 처리량(throughput) 감소

**사용 시기**: 충돌 빈도가 높은 경우, 데이터 일관성이 매우 중요한 경우

#### Optimistic Lock (낙관적 락킹)
**개념**: "충돌이 거의 발생하지 않을 것이다"라고 가정하고 버전 정보를 이용해 충돌을 감지

**🎟️ 콘서트 티켓팅 예시:**
- 티켓에 버전 번호를 적어놓음 (V1, V2, V3...)
- 결제할 때 "이 티켓이 아직 V1인가?"를 확인
- 만약 다른 사람이 먼저 샀다면 V2가 되어있음 → 충돌 감지!

**📝 위키피디아 편집 예시:**
- 문서 편집 시작할 때의 버전을 기억
- 저장할 때 "아직 그 버전이 맞나?" 확인
- 다른 사람이 먼저 편집했다면 "편집 충돌!" 메시지 표시

**동작 방식**:
1. 데이터 조회 시 버전 정보도 함께 조회 (티켓 버전 확인)
2. 데이터 수정 시 버전 정보가 일치하는지 확인 (아직 V1인가?)
3. 버전이 다르면 충돌로 판단하고 재시도 (V2로 바뀜 → 다시 시도)

**장점**:
- 높은 성능 (락 대기 시간 없음)
- Deadlock 발생하지 않음
- 높은 처리량

**단점**:
- 충돌 발생 시 재시도 필요
- 애플리케이션 레벨에서 재시도 로직 구현 필요
- 충돌이 많으면 성능 저하

**사용 시기**: 충돌 빈도가 낮은 경우, 높은 처리량이 필요한 경우

**🏃‍♂️ 실생활 비교:**
- **Pessimistic**: 화장실 가기 전에 미리 문 잠그기
- **Optimistic**: 화장실에 갔는데 누가 있으면 나중에 다시 오기

**구현 예시**:
```sql
-- 테이블에 version 컬럼 추가
CREATE TABLE products (
  id INT PRIMARY KEY,
  name VARCHAR(255),
  stock INT,
  version INT DEFAULT 1  -- 버전 관리용
);

-- Optimistic Lock을 이용한 업데이트
UPDATE products 
SET stock = stock - 1, 
    version = version + 1 
WHERE id = 1 AND version = 5;  -- 현재 버전이 5인 경우만 업데이트
```

### 4. 동시성 테스트 시나리오 설계

**🧪 테스트는 왜 필요한가?**
- 실제 서비스에서는 수백, 수천 명이 동시에 접속
- 개발할 때는 한 명씩만 테스트하니까 문제를 놓칠 수 있음
- "100명이 동시에 마지막 1개 상품을 주문하면 어떻게 될까?" 같은 상황을 미리 테스트

#### 테스트 시나리오 유형

**1. Race Condition 테스트**
**🏃‍♂️ 달리기 경주 비유:**
- 여러 선수(트랜잭션)가 동시에 결승선(데이터)에 도착하려고 할 때 누가 이기는지 테스트

**실제 상황**: 
- 여러 고객이 동시에 같은 계좌에서 돈을 출금
- 마지막 1개 남은 상품을 여러 명이 동시에 주문

```typescript
// 시나리오: 동일한 리소스에 대한 동시 접근
describe('Race Condition 테스트', () => {
  it('동시에 잔액 차감 시도', async () => {
    const userId = 1;
    const initialBalance = 10000;
    
    // 🎯 테스트 목표: 3명이 동시에 5000원씩 출금 시도
    // 예상 결과: 2명은 실패해야 함 (잔액은 10000원이니까)
    const promises = Array(3).fill(null).map(() => 
      balanceService.useBalance(userId, 5000)
    );
    
    const results = await Promise.allSettled(promises);
    
    // 검증: 성공은 최대 2번까지만
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    expect(successCount).toBeLessThanOrEqual(2);
  });
});
```

**2. Lost Update 테스트**
**📝 공동 문서 작성 비유:**
- 3명이 동시에 같은 문서를 편집할 때, 마지막에 저장한 사람의 내용만 남고 나머지는 사라지는 문제

**실제 상황**: 
- 여러 주문이 동시에 들어와서 재고를 차감할 때
- 한 사용자가 여러 기기에서 동시에 잔액을 사용할 때

```typescript
// 시나리오: Read-Modify-Write 패턴에서 업데이트 손실
describe('Lost Update 테스트', () => {
  it('동시 재고 업데이트 시 데이터 손실 방지', async () => {
    const productId = 1;
    const initialStock = 100;
    
    // 🎯 테스트 목표: 동시에 재고 감소했을 때 모든 차감이 정확히 반영되는지
    // 잘못된 경우: 100 → 90 (나머지 두 번의 차감이 무시됨)
    // 올바른 경우: 100 → 40 (모든 차감이 정확히 반영됨)
    const promises = [
      productService.deductStock(productId, 10),
      productService.deductStock(productId, 20),
      productService.deductStock(productId, 30)
    ];
    
    await Promise.all(promises);
    
    // 최종 재고가 정확한지 검증
    const finalStock = await productService.getStock(productId);
    expect(finalStock).toBe(40); // 100 - 10 - 20 - 30 = 40
  });
});
```

**3. Deadlock 테스트**
**🤝 서로 양보 안하는 상황 비유:**
- A: "B가 가진 걸 내놔야 내가 가진 걸 줄게"
- B: "A가 가진 걸 내놔야 내가 가진 걸 줄게"
- 결과: 둘 다 영원히 기다림 (무한 대기!)

**실제 상황**:
- 주문 1: 상품A → 상품B 순서로 재고 차감
- 주문 2: 상품B → 상품A 순서로 재고 차감
- 서로 상대방이 가진 상품의 Lock을 기다리며 무한 대기

```typescript
// 시나리오: 서로 다른 순서로 리소스 접근
describe('Deadlock 테스트', () => {
  it('서로 다른 순서의 리소스 접근 시 데드락 방지', async () => {
    const startTime = Date.now();
    
    const promises = [
      // 트랜잭션 1: Product A → Product B 순서
      orderService.createOrder([
        { productId: 1, quantity: 1 },
        { productId: 2, quantity: 1 }
      ]),
      // 트랜잭션 2: Product B → Product A 순서 (위험!)
      orderService.createOrder([
        { productId: 2, quantity: 1 },
        { productId: 1, quantity: 1 }
      ])
    ];
    
    await Promise.all(promises);
    
    const executionTime = Date.now() - startTime;
    // 🎯 테스트 목표: 데드락으로 인한 무한 대기가 없어야 함
    expect(executionTime).toBeLessThan(10000); // 10초 이내 완료
  });
});
```

**4. 부하 테스트 (Load Testing)**
**🎪 축제 입장 시뮬레이션 비유:**
- 1000명이 동시에 축제 입장권(한정판)을 사려고 할 때
- 서버가 터지지 않고 정확한 수량만큼만 판매되는지 확인

**실제 상황**:
- 블랙프라이데이나 타임딜 같은 대규모 할인 행사
- 인기 상품 출시일에 몰리는 주문들
- "진짜 많은 사람들이 동시에 접속해도 괜찮나?" 테스트

```typescript
// 시나리오: 높은 동시 접근 상황 시뮬레이션
describe('동시성 부하 테스트', () => {
  it('1000개 동시 주문 요청 처리', async () => {
    const concurrentRequests = 1000;
    const promises = [];
    
    // 🎯 테스트 목표: 1000명이 동시에 주문해도 시스템이 안정적으로 동작
    for (let i = 0; i < concurrentRequests; i++) {
      promises.push(
        orderService.createOrder({
          userId: Math.floor(Math.random() * 10) + 1,
          productId: Math.floor(Math.random() * 5) + 1,
          quantity: 1
        })
      );
    }
    
    const results = await Promise.allSettled(promises);
    
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failureCount = results.filter(r => r.status === 'rejected').length;
    
    console.log(`성공: ${successCount}, 실패: ${failureCount}`);
    
    // 🔍 중요: 성공/실패 수가 비즈니스 로직에 맞는지 확인
    // 예: 재고가 100개였다면, 성공은 최대 100개까지만
    
    // 데이터 무결성 검증 (가장 중요!)
    await validateDataConsistency();
  });
});
```

#### 테스트 도구 및 기법

**1. 동시성 시뮬레이션**
**🎬 영화 촬영 비유:** 여러 배우가 동시에 연기하는 장면 찍기

- **`Promise.all()`**: 모든 배우가 동시에 연기 시작, 모두 끝날 때까지 기다림
- **`Promise.allSettled()`**: 일부 배우가 실수해도 상관없이, 모든 배우의 연기가 끝날 때까지 기다림
- **`setTimeout()`**: "액션!" 하고 1초 후에 연기 시작하라고 타이밍 조절

```javascript
// 예시: 5명이 동시에 같은 상품 주문
const promises = Array(5).fill(null).map(() => 
  orderService.createOrder(productId, quantity)
);
await Promise.allSettled(promises); // 성공/실패 상관없이 모든 결과 받기
```

**2. 검증 방법**
**🔍 사건 수사 비유:** 사건 후 현장 조사하기

- **최종 데이터 상태 확인**: "결국 재고가 몇 개 남았나?"
- **비즈니스 규칙 위반 체크**: "음수 재고는 없나? 잔액 부족인데 주문 성공한 게 있나?"
- **성능 메트릭 측정**: "10초 안에 끝났나? 메모리는 얼마나 썼나?"

```javascript
// 검증 예시
const finalStock = await getProductStock(productId);
expect(finalStock).toBeGreaterThanOrEqual(0); // 음수 재고 없어야 함

const userBalance = await getUserBalance(userId);
expect(userBalance).toBeGreaterThanOrEqual(0); // 음수 잔액 없어야 함
```

**3. 테스트 환경**
**🏗️ 공사장 안전 점검 비유:** 실제 건물과 똑같은 조건에서 테스트

- **실제 DB 사용 (TestContainers)**: 가짜 DB가 아닌 진짜 PostgreSQL 사용
- **트랜잭션 격리 수준 설정**: 실제 서비스와 동일한 DB 설정
- **적절한 테스트 데이터 준비**: 현실적인 사용자, 상품, 쿠폰 데이터

```javascript
// 실제 DB 환경 설정 예시
beforeAll(async () => {
  // 진짜 PostgreSQL 컨테이너 시작
  const postgres = await new PostgreSqlContainer().start();
  
  // 실제 서비스와 동일한 격리 수준 설정
  await dataSource.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
  
  // 현실적인 테스트 데이터 생성
  await createTestUsers(100);
  await createTestProducts(50);
  await createTestCoupons(10);
});
```

**🎯 테스트 성공의 핵심:**
1. **실제 상황과 최대한 비슷하게**: 진짜 DB, 진짜 설정 사용
2. **다양한 시나리오**: 성공 케이스뿐만 아니라 실패 케이스도 테스트
3. **데이터 검증**: 숫자가 정확한지, 비즈니스 규칙을 위반하지 않았는지 확인