# Redis 분산락과 캐시 통합 전략

## 개요

현재 프로젝트는 `ioredis`를 사용한 Redis 분산락 시스템이 이미 구축되어 있습니다. 이 문서는 기존 분산락 시스템을 유지하면서 NestJS 표준 캐시 시스템을 통합하는 최적의 전략을 제시합니다.

---

## 현재 상황 분석

### 기존 Redis 인프라
```typescript
// src/redis/redis.module.ts - 현재 구현
@Global()
@Module({
  imports: [
    IoRedisModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        type: 'single',
        options: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get('REDIS_PORT', 6380),
          db: 0, // 분산락 전용 DB
        },
      }),
    }),
  ],
  providers: [RedisLockService],
  exports: [RedisLockService],
})
export class RedisModule {}
```

### 현재 사용 중인 분산락 패턴
- **잔액 충전**: `recharge:balance:${userId}` 락
- **잔액 사용**: `use:balance:${userId}` 락  
- **주문 처리**: `pay:order:${userId}` 락
- **재고 관리**: 상품 옵션별 락 적용

---

## 패키지 선택 분석

### 옵션 1: cache-manager-redis-yet (권장)

**장점:**
- `@nestjs/cache-manager`와 완벽 호환
- NestJS CacheInterceptor 자동 통합
- cache-manager 생태계 활용
- 표준화된 캐시 API 제공
- TTL, 직렬화 자동 처리

**단점:**
- 추가 패키지 설치 필요 (~2MB)
- ioredis를 래핑한 구조로 약간의 오버헤드

### 옵션 2: 기존 ioredis 직접 활용

**장점:**
- 추가 패키지 설치 불필요
- 기존 Redis 연결 재사용
- 직접적인 Redis 제어
- 메모리 사용량 최소화

**단점:**
- NestJS 캐시 생태계와 분리
- CacheInterceptor 수동 구현 필요
- 캐시 추상화 레이어 부재
- TTL, 직렬화 수동 처리

---

## 추천 아키텍처: 하이브리드 접근법

### Redis DB 분리 전략

```
┌─────────────────────────────────────┐
│            Redis Server             │
│  (localhost:6380)                   │
├─────────────────────────────────────┤
│ DB 0: 분산락 (기존 ioredis)          │
│  - lock:recharge:balance:*          │
│  - lock:use:balance:*               │
│  - lock:pay:order:*                 │
├─────────────────────────────────────┤
│ DB 1: 캐시 (cache-manager-redis-yet)│
│  - product:*                        │
│  - balance:*                        │
│  - coupon:*                         │
│  - stats:*                          │
└─────────────────────────────────────┘
```

### 통합 모듈 구조

```typescript
// src/cache/cache.module.ts
import { Global, Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-redis-yet';
import { RedisModule } from '../redis/redis.module'; // 기존 분산락 모듈

@Global()
@Module({
  imports: [
    // 1. NestJS 표준 캐시 시스템 (DB 1)
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        store: await redisStore({
          socket: {
            host: configService.get('REDIS_HOST', 'localhost'),
            port: configService.get('REDIS_PORT', 6380),
            password: configService.get('REDIS_PASSWORD'),
          },
          db: 1, // 캐시 전용 DB
          ttl: 60 * 1000, // 기본 1분 TTL
          max: 10000, // 최대 캐시 항목 수
          // 추가 설정
          enableReadyCheck: true,
          lazyConnect: false,
          retryStrategy: (times: number) => {
            if (times > 3) return null;
            return Math.min(times * 100, 1000);
          },
        }),
      }),
    }),
    
    // 2. 기존 분산락 모듈 (DB 0)
    RedisModule,
  ],
  providers: [
    RedisCacheService, // 캐시 헬퍼 서비스
    CacheMetricsService, // 캐시 성능 모니터링
  ],
  exports: [CacheModule, RedisCacheService, CacheMetricsService],
})
export class IntegratedCacheModule {}
```

---

## 통합 서비스 구현

### 1. Redis 캐시 헬퍼 서비스

```typescript
// src/cache/redis-cache.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class RedisCacheService {
  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  /**
   * 캐시 조회 with 타입 안전성
   */
  async get<T>(key: string): Promise<T | null> {
    return await this.cacheManager.get<T>(key);
  }

  /**
   * 캐시 저장 with TTL
   */
  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    await this.cacheManager.set(key, value, ttlMs);
  }

  /**
   * 캐시 삭제
   */
  async del(key: string): Promise<void> {
    await this.cacheManager.del(key);
  }

  /**
   * 패턴 기반 캐시 삭제
   */
  async delPattern(pattern: string): Promise<void> {
    const store = this.cacheManager.store;
    if (store && typeof store.keys === 'function') {
      const keys = await store.keys(pattern);
      if (keys.length > 0) {
        await Promise.all(keys.map(key => this.cacheManager.del(key)));
      }
    }
  }

  /**
   * 캐시 존재 여부 확인
   */
  async has(key: string): Promise<boolean> {
    const value = await this.cacheManager.get(key);
    return value !== null && value !== undefined;
  }

  /**
   * TTL 조회
   */
  async ttl(key: string): Promise<number> {
    const store = this.cacheManager.store;
    if (store && typeof store.ttl === 'function') {
      return await store.ttl(key);
    }
    return -1;
  }
}
```

### 2. 캐시 메트릭 서비스

```typescript
// src/cache/cache-metrics.service.ts
import { Injectable, Logger } from '@nestjs/common';

interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  dels: number;
  totalRequests: number;
  hitRate: number;
}

@Injectable()
export class CacheMetricsService {
  private readonly logger = new Logger(CacheMetricsService.name);
  private metrics: Map<string, CacheMetrics> = new Map();

  recordHit(key: string): void {
    const keyPrefix = this.getKeyPrefix(key);
    const metric = this.getOrCreateMetric(keyPrefix);
    metric.hits++;
    metric.totalRequests++;
    metric.hitRate = (metric.hits / metric.totalRequests) * 100;
  }

  recordMiss(key: string): void {
    const keyPrefix = this.getKeyPrefix(key);
    const metric = this.getOrCreateMetric(keyPrefix);
    metric.misses++;
    metric.totalRequests++;
    metric.hitRate = (metric.hits / metric.totalRequests) * 100;
  }

  recordSet(key: string): void {
    const keyPrefix = this.getKeyPrefix(key);
    const metric = this.getOrCreateMetric(keyPrefix);
    metric.sets++;
  }

  recordDel(key: string): void {
    const keyPrefix = this.getKeyPrefix(key);
    const metric = this.getOrCreateMetric(keyPrefix);
    metric.dels++;
  }

  getMetrics(): Record<string, CacheMetrics> {
    const result = {};
    this.metrics.forEach((metric, key) => {
      result[key] = { ...metric };
    });
    return result;
  }

  logMetrics(): void {
    const metrics = this.getMetrics();
    Object.entries(metrics).forEach(([key, metric]) => {
      this.logger.log(
        `Cache [${key}] - Hit Rate: ${metric.hitRate.toFixed(2)}% ` +
        `(${metric.hits}H/${metric.misses}M), Sets: ${metric.sets}, Dels: ${metric.dels}`
      );
    });
  }

  private getKeyPrefix(key: string): string {
    return key.split(':')[0] || 'unknown';
  }

  private getOrCreateMetric(keyPrefix: string): CacheMetrics {
    if (!this.metrics.has(keyPrefix)) {
      this.metrics.set(keyPrefix, {
        hits: 0,
        misses: 0,
        sets: 0,
        dels: 0,
        totalRequests: 0,
        hitRate: 0,
      });
    }
    return this.metrics.get(keyPrefix)!;
  }
}
```

---

## 실제 비즈니스 로직 통합 예제

### 1. ProductService에 캐시 적용

```typescript
// src/product/product.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { RedisCacheService } from '../cache/redis-cache.service';
import { CacheMetricsService } from '../cache/cache-metrics.service';

@Injectable()
export class ProductService {
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: IProductRepository,
    private readonly cacheService: RedisCacheService,
    private readonly metricsService: CacheMetricsService,
  ) {}

  async getProduct(id: number): Promise<GetProductResponse> {
    const cacheKey = `product:${id}`;
    
    // 캐시 조회
    const cachedProduct = await this.cacheService.get<GetProductResponse>(cacheKey);
    if (cachedProduct) {
      this.metricsService.recordHit(cacheKey);
      return cachedProduct;
    }
    
    this.metricsService.recordMiss(cacheKey);
    
    // DB 조회
    const product = await this.productRepository.findByIdWithOptions(id);
    if (!product) {
      throw new NotFoundException(`ID가 '${id}'인 상품을 찾을 수 없습니다.`);
    }
    
    const response = GetProductResponse.of(product);
    
    // 캐시 저장 (1시간 TTL)
    await this.cacheService.set(cacheKey, response, 60 * 60 * 1000);
    this.metricsService.recordSet(cacheKey);
    
    return response;
  }

  async getTopSellingProducts(days: number = 3): Promise<any[]> {
    const cacheKey = `products:top-selling:${days}`;
    
    // 캐시 조회
    const cachedProducts = await this.cacheService.get<any[]>(cacheKey);
    if (cachedProducts) {
      this.metricsService.recordHit(cacheKey);
      return cachedProducts;
    }
    
    this.metricsService.recordMiss(cacheKey);
    
    // 비즈니스 로직 실행
    const endDate = dayjs().format('YYYY-MM-DD');
    const startDate = dayjs().subtract(days, 'day').format('YYYY-MM-DD');
    const rawDailySales = await this.productSalesDailyRepository.findDailySalesByDateRange(startDate, endDate);
    
    const topProducts = this.processTopSellingData(rawDailySales);
    
    // 캐시 저장 (10분 TTL)
    await this.cacheService.set(cacheKey, topProducts, 10 * 60 * 1000);
    this.metricsService.recordSet(cacheKey);
    
    return topProducts;
  }

  private processTopSellingData(rawData: any[]): any[] {
    if (!rawData || rawData.length === 0) {
      return [];
    }

    const dailySales = rawData.map((row) => ({
      productId: Number(row.productId),
      productName: row.productName,
      totalSales: Number(row.totalSales),
    }));

    return dailySales.slice(0, 5).map((product, index) => ({
      ...product,
      rank: index + 1,
    }));
  }
}
```

### 2. BalanceService에 분산락 + 캐시 통합

```typescript
// src/balance/balance.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { RedisLockService } from '../redis/redis-lock.service';
import { RedisCacheService } from '../cache/redis-cache.service';

@Injectable()
export class BalanceService {
  constructor(
    @Inject(BALANCE_REPOSITORY)
    private readonly balanceRepository: IBalanceRepository,
    private readonly redisLockService: RedisLockService,
    private readonly cacheService: RedisCacheService,
  ) {}

  async getBalance(userId: number) {
    const cacheKey = `balance:${userId}`;
    
    // 캐시 조회
    const cachedBalance = await this.cacheService.get<any>(cacheKey);
    if (cachedBalance) {
      return cachedBalance;
    }
    
    // DB 조회
    const userBalance = await this.balanceRepository.findByUserId(userId);
    if (!userBalance) {
      throw new NotFoundException(`ID가 '${userId}'인 사용자의 잔액 정보를 찾을 수 없습니다.`);
    }
    
    // 캐시 저장 (5분 TTL)
    await this.cacheService.set(cacheKey, userBalance, 5 * 60 * 1000);
    
    return userBalance;
  }

  async rechargeBalance(userId: number, request: BalanceRechargeRequest) {
    const lockKey = `recharge:balance:${userId}`;
    const lockValue = this.redisLockService.generateLockValue('rechargeBalance', userId, request);
    const lockTTL = 10;

    // 1. 분산락 획득 (기존 ioredis - DB 0)
    const acquired = await this.redisLockService.tryAcquireLock(lockKey, lockValue, {
      ttlSeconds: lockTTL,
      retryAttempts: 3,
      retryDelayMs: 100,
    });

    if (!acquired) {
      throw new ConflictException(`잔액 충전이 진행 중입니다. 잠시 후 다시 시도해주세요. (사용자: ${userId})`);
    }

    try {
      const result = await this.executeRechargeWithRetry(userId, request);
      
      // 2. 캐시 무효화 (cache-manager - DB 1)
      const cacheKey = `balance:${userId}`;
      await this.cacheService.del(cacheKey);
      
      return result;
    } finally {
      await this.redisLockService.releaseLock(lockKey, lockValue);
    }
  }

  async useBalance(userId: number, usedAmount: number) {
    const lockKey = `use:balance:${userId}`;
    const lockValue = this.redisLockService.generateLockValue('useBalance', userId, { usedAmount });
    const lockTTL = 10;

    // 1. 분산락 획득 (기존 ioredis - DB 0)
    const acquired = await this.redisLockService.tryAcquireLock(lockKey, lockValue, {
      ttlSeconds: lockTTL,
      retryAttempts: 3,
      retryDelayMs: 100,
    });

    if (!acquired) {
      throw new ConflictException(`잔액 사용이 진행 중입니다. 잠시 후 다시 시도해주세요. (사용자: ${userId})`);
    }

    try {
      const result = await this.executeUseBalanceWithRetry(userId, usedAmount);
      
      // 2. 캐시 무효화 (cache-manager - DB 1)
      const cacheKey = `balance:${userId}`;
      await this.cacheService.del(cacheKey);
      
      return result;
    } finally {
      await this.redisLockService.releaseLock(lockKey, lockValue);
    }
  }
}
```

### 3. OrderFacade에 통합 적용

```typescript
// src/order/order.facade.ts
import { Injectable } from '@nestjs/common';
import { RedisLockService } from '../redis/redis-lock.service';
import { RedisCacheService } from '../cache/redis-cache.service';

@Injectable()
export class OrderFacade {
  constructor(
    private readonly orderService: OrderService,
    private readonly balanceService: BalanceService,
    private readonly productService: ProductService,
    private readonly redisLockService: RedisLockService,
    private readonly cacheService: RedisCacheService,
  ) {}

  async pay(userId: number, request: CreateOrderRequest): Promise<CreateOrderResponse> {
    const lockKey = `pay:order:${userId}`;
    const lockValue = this.redisLockService.generateLockValue('pay', userId, request);
    const lockTTL = 15;

    // 1. 분산락 획득 (기존 ioredis - DB 0)
    const acquired = await this.redisLockService.tryAcquireLock(lockKey, lockValue, {
      ttlSeconds: lockTTL,
      retryAttempts: 3,
      retryDelayMs: 200,
    });

    if (!acquired) {
      throw new ConflictException(`주문 처리가 진행 중입니다. 잠시 후 다시 시도해주세요. (사용자: ${userId})`);
    }

    try {
      // 주문 처리 로직...
      const order = await this.confirmAndCreateOrder(userId, request, args);
      
      // 2. 관련 캐시 무효화 (cache-manager - DB 1)
      await Promise.all([
        this.cacheService.del(`balance:${userId}`),
        this.cacheService.delPattern('products:top-selling:*'),
        this.cacheService.delPattern('stats:*'),
      ]);
      
      // 주문 생성 이벤트 발생...
      
      return order;
    } finally {
      await this.redisLockService.releaseLock(lockKey, lockValue);
    }
  }
}
```

---

## NestJS CacheInterceptor 확장

### 1. 커스텀 캐시 인터셉터

```typescript
// src/cache/cache.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { CacheMetricsService } from './cache-metrics.service';

@Injectable()
export class CustomCacheInterceptor implements NestInterceptor {
  constructor(
    private readonly metricsService: CacheMetricsService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const startTime = Date.now();
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;
    
    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        
        // 성능 로그
        if (duration > 1000) {
          console.warn(`Slow cache operation: ${method} ${url} - ${duration}ms`);
        }
        
        // 메트릭 업데이트는 백그라운드에서 실행
        setImmediate(() => {
          this.metricsService.logMetrics();
        });
      }),
    );
  }
}
```

### 2. 조건부 캐시 데코레이터

```typescript
// src/cache/decorators/cacheable.decorator.ts
import { applyDecorators, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor } from '@nestjs/cache-manager';

interface CacheableOptions {
  ttl?: number;
  key?: string;
  condition?: (context: ExecutionContext) => boolean;
}

export function Cacheable(options: CacheableOptions = {}) {
  return applyDecorators(
    UseInterceptors(CacheInterceptor),
    // 조건부 캐시 로직은 인터셉터에서 처리
  );
}

// 사용 예시
@Injectable()
export class ProductService {
  @Cacheable({ ttl: 3600, key: 'product:{{id}}' })
  async getProduct(id: number): Promise<Product> {
    // 자동 캐시 적용
    return await this.productRepository.findById(id);
  }
}
```

---

## 성능 모니터링 대시보드

### 1. 캐시 상태 엔드포인트

```typescript
// src/cache/cache.controller.ts
import { Controller, Get } from '@nestjs/common';
import { CacheMetricsService } from './cache-metrics.service';
import { RedisCacheService } from './redis-cache.service';

@Controller('cache')
export class CacheController {
  constructor(
    private readonly metricsService: CacheMetricsService,
    private readonly cacheService: RedisCacheService,
  ) {}

  @Get('metrics')
  getCacheMetrics() {
    return {
      timestamp: new Date().toISOString(),
      metrics: this.metricsService.getMetrics(),
    };
  }

  @Get('health')
  async getCacheHealth() {
    try {
      const testKey = 'health:test';
      const testValue = 'ok';
      
      await this.cacheService.set(testKey, testValue, 1000);
      const retrieved = await this.cacheService.get(testKey);
      await this.cacheService.del(testKey);
      
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        test: retrieved === testValue ? 'passed' : 'failed',
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message,
      };
    }
  }
}
```

### 2. 정기적 메트릭 로깅

```typescript
// src/cache/cache-scheduler.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CacheMetricsService } from './cache-metrics.service';

@Injectable()
export class CacheSchedulerService {
  private readonly logger = new Logger(CacheSchedulerService.name);

  constructor(
    private readonly metricsService: CacheMetricsService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  logCacheMetrics() {
    this.logger.log('=== Cache Metrics Report ===');
    this.metricsService.logMetrics();
  }

  @Cron(CronExpression.EVERY_HOUR)
  resetHourlyMetrics() {
    // 시간별 메트릭 리셋 로직
    this.logger.log('Cache metrics reset completed');
  }
}
```

---

## 마이그레이션 가이드

### 1. 패키지 설치

```bash
npm install @nestjs/cache-manager cache-manager-redis-yet
```

### 2. 단계별 적용 계획

1. **Phase 1: 캐시 모듈 설정** (1일)
   - `IntegratedCacheModule` 구현
   - `RedisCacheService` 구현
   - 기본 캐시 테스트

2. **Phase 2: ProductService 적용** (1일)
   - 상품 조회 캐시 적용
   - 베스트셀러 캐시 적용
   - 성능 테스트

3. **Phase 3: BalanceService 적용** (1일)
   - 잔액 조회 캐시 적용
   - 분산락과 캐시 무효화 연동
   - 동시성 테스트

4. **Phase 4: 모니터링 도구** (1일)
   - CacheMetricsService 적용
   - 대시보드 엔드포인트 구현
   - 알림 설정

### 3. 성능 측정 기준

- **캐시 히트율**: 80% 이상 목표
- **응답 시간 단축**: 50% 이상
- **DB 쿼리 감소**: 40% 이상
- **동시성 처리**: 기존 분산락 성능 유지

---

## 결론

**cache-manager-redis-yet 사용을 강력히 권장합니다**:

1. **표준 호환성**: NestJS 생태계와 완벽 통합
2. **개발 생산성**: 캐시 로직에만 집중 가능
3. **확장성**: 캐시 스토어 변경 시 최소한의 코드 수정
4. **안정성**: 검증된 cache-manager 생태계 활용
5. **기존 시스템 보존**: 분산락 시스템 그대로 유지

이 하이브리드 접근법으로 기존 분산락의 안정성을 유지하면서도 현대적인 캐시 시스템의 이점을 모두 얻을 수 있습니다.