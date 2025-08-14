import { Injectable, BadRequestException, NotFoundException, Inject, ConflictException } from '@nestjs/common';
import { IBalanceRepository, BALANCE_REPOSITORY } from './domain/balance.repository.interface';
import { BalanceRechargeRequest } from './dto/request/balance-recharge-request';
import { Retry } from '../common/decorator/retry.decorator';
import { OptimisticLockException } from '../common/exception/optimistic-lock.exception';
import { RedisLockService } from '../redis/redis-lock.service';
import { RedisCacheService } from '../redis/redis-cache.service';

@Injectable()
export class BalanceService {
  constructor(
    @Inject(BALANCE_REPOSITORY)
    private readonly balanceRepository: IBalanceRepository,
    private readonly redisLockService: RedisLockService,
    private readonly redisCacheService: RedisCacheService,
  ) {}

  async getBalance(userId: number) {
    // 캐시 키 생성
    const cacheKey = `user:${userId}:balance`;

    // 캐시에서 먼저 조회
    const cachedBalance = await this.redisCacheService.get<any>(cacheKey);
    if (cachedBalance) {
      return cachedBalance;
    }

    // 캐시에 없으면 DB에서 조회
    const userBalance = await this.balanceRepository.findByUserId(userId);

    if (!userBalance) {
      throw new NotFoundException(`ID가 '${userId}'인 사용자의 잔액 정보를 찾을 수 없습니다.`);
    }

    // 조회된 결과를 캐시에 저장 (5분 TTL - 짧은 TTL 설정)
    await this.redisCacheService.set(cacheKey, userBalance, 300);

    return userBalance;
  }

  async rechargeBalance(userId: number, request: BalanceRechargeRequest) {
    const lockKey = `recharge:balance:${userId}`;
    const lockValue = this.redisLockService.generateLockValue('rechargeBalance', userId, request);
    const lockTTL = 10;

    const acquired = await this.redisLockService.tryAcquireLock(lockKey, lockValue, {
      ttlSeconds: lockTTL,
      retryAttempts: 3,
      retryDelayMs: 100,
    });

    if (!acquired) {
      throw new ConflictException(`잔액 충전이 진행 중입니다. 잠시 후 다시 시도해주세요. (사용자: ${userId})`);
    }

    try {
      return await this.executeRechargeWithRetry(userId, request);
    } finally {
      await this.redisLockService.releaseLock(lockKey, lockValue);
    }
  }

  @Retry({
    maxAttempts: 3,
    baseDelay: 50,
    retryIf: (error: any) => error instanceof OptimisticLockException,
  })
  private async executeRechargeWithRetry(userId: number, request: BalanceRechargeRequest) {
    try {
      // 최신 잔액 정보 조회
      const balanceEntity = await this.balanceRepository.findByUserId(userId);

      if (!balanceEntity) {
        throw new NotFoundException(`ID가 '${userId}'인 사용자의 잔액 정보를 찾을 수 없습니다.`);
      }

      const previousBalance = balanceEntity.amount;
      const newBalance = previousBalance + request.amount;

      // 낙관적 락을 사용한 업데이트
      await this.balanceRepository.updateBalanceWithOptimisticLock(balanceEntity, newBalance);
      
      // 잔액 변경 후 캐시 무효화
      await this.invalidateBalanceCache(userId);
    } catch (error) {
      if (error instanceof OptimisticLockException) {
        throw error; // 재시도 로직에서 처리
      }
      throw error;
    }
  }

  async useBalance(userId: number, usedAmount: number) {
    const lockKey = `use:balance:${userId}`;
    const lockValue = this.redisLockService.generateLockValue('useBalance', userId, { usedAmount });
    const lockTTL = 10;

    const acquired = await this.redisLockService.tryAcquireLock(lockKey, lockValue, {
      ttlSeconds: lockTTL,
      retryAttempts: 3,
      retryDelayMs: 100,
    });

    if (!acquired) {
      throw new ConflictException(`잔액 사용이 진행 중입니다. 잠시 후 다시 시도해주세요. (사용자: ${userId})`);
    }

    try {
      return await this.executeUseBalanceWithRetry(userId, usedAmount);
    } finally {
      await this.redisLockService.releaseLock(lockKey, lockValue);
    }
  }

  @Retry({
    maxAttempts: 3,
    baseDelay: 50,
    retryIf: (error: any) => error instanceof OptimisticLockException,
  })
  private async executeUseBalanceWithRetry(userId: number, usedAmount: number) {
    this.validateUsedAmount(usedAmount);

    try {
      // 최신 잔액 정보 조회
      const balanceEntity = await this.balanceRepository.findByUserId(userId);
      if (!balanceEntity) {
        throw new NotFoundException(`ID가 '${userId}'인 사용자의 잔액 정보를 찾을 수 없습니다.`);
      }

      const currentBalance = balanceEntity.amount;

      if (currentBalance < usedAmount) {
        throw new BadRequestException(
          `잔액이 부족합니다. 현재 잔액: ${currentBalance.toLocaleString()}원, 사용 요청 금액: ${usedAmount.toLocaleString()}원`,
        );
      }

      // 낙관적 락을 사용한 차감
      const updatedBalance = await this.balanceRepository.deductBalanceWithOptimisticLock(balanceEntity, usedAmount);
      
      // 잔액 변경 후 캐시 무효화
      await this.invalidateBalanceCache(userId);

      return {
        userId,
        usedAmount,
        currentBalance: updatedBalance.amount,
      };
    } catch (error) {
      if (error instanceof OptimisticLockException) {
        throw error; // 재시도 로직에서 처리
      }
      throw error;
    }
  }

  async initializeBalance(userId: number) {
    await this.balanceRepository.save({ userId, amount: 0 });
  }

  private validateUsedAmount(usedAmount: number): void {
    // 숫자 검증
    if (typeof usedAmount !== 'number' || isNaN(usedAmount)) {
      throw new BadRequestException('사용 금액은 숫자여야 합니다.');
    }

    // 양수 검증
    if (usedAmount <= 0) {
      throw new BadRequestException('사용 금액은 0보다 커야 합니다.');
    }

    // 최소 금액 검증
    if (usedAmount < 100) {
      throw new BadRequestException('사용 금액은 최소 100원 이상이어야 합니다.');
    }

    // 100원 단위 검증
    if (usedAmount % 100 !== 0) {
      throw new BadRequestException('사용 금액은 100원 단위로만 입력 가능합니다.');
    }
  }

  /**
   * 사용자 잔액 캐시 무효화
   */
  private async invalidateBalanceCache(userId: number): Promise<void> {
    const cacheKey = `user:${userId}:balance`;
    await this.redisCacheService.del(cacheKey);
  }

}
