import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import * as dayjs from 'dayjs';

export interface LockOptions {
  ttlSeconds?: number;
  retryAttempts?: number;
  retryDelayMs?: number;
}

export interface LockValue {
  methodName: string;
  userId?: number;
  timestamp: string;
  requestData?: Record<string, any>;
}

@Injectable()
export class RedisLockService {
  private readonly logger = new Logger(RedisLockService.name);
  private readonly lockPrefix = 'lock:';

  constructor(@InjectRedis() private readonly redis: Redis) {}

  /**
   * Redis Simple Lock 획득
   * @param key 락 키
   * @param lockValue 락 소유자 식별 값 (UUID 권장)
   * @param ttlSeconds TTL (초 단위, 기본 5초)
   * @returns 락 획득 성공 여부
   */
  async acquireLock(key: string, lockValue: string, ttlSeconds: number = 5): Promise<boolean> {
    const lockKey = `${this.lockPrefix}${key}`;

    try {
      // SET 명령어의 객체 옵션 사용 - 원자적 락 획득
      const result = await this.redis.set(lockKey, lockValue, 'EX', ttlSeconds, 'NX');

      const acquired = result === 'OK';

      if (acquired) {
        const parsedValue = this.parseLockValue(lockValue);
        const requestInfo = parsedValue?.requestData ? `, data: ${JSON.stringify(parsedValue.requestData)}` : '';
        this.logger.debug(
          `Lock acquired: ${lockKey} (method: ${parsedValue?.methodName}, user: ${parsedValue?.userId}${requestInfo})`,
        );
      }

      return acquired;
    } catch (error) {
      this.logger.error(`Failed to acquire lock ${lockKey}: ${error.message}`);
      return false;
    }
  }

  /**
   * Redis Simple Lock 해제
   * GET + DEL 명령어 조합으로 안전하게 처리
   * @param key 락 키
   * @param lockValue 락 소유자 식별 값
   * @returns 락 해제 성공 여부
   */
  async releaseLock(key: string, lockValue: string): Promise<boolean> {
    const lockKey = `${this.lockPrefix}${key}`;

    try {
      // 1. 현재 락 값 확인
      const currentValue = await this.redis.get(lockKey);

      // 2. 락이 존재하지 않거나 값이 일치하지 않으면 해제 실패
      if (currentValue !== lockValue) {
        this.logger.warn(`Failed to release lock ${lockKey}: value mismatch or lock not found`);
        return false;
      }

      // 3. 값이 일치하면 락 삭제
      const deleteResult = await this.redis.del(lockKey);
      const released = deleteResult === 1;

      if (released) {
        const parsedValue = this.parseLockValue(lockValue);
        const requestInfo = parsedValue?.requestData ? `, data: ${JSON.stringify(parsedValue.requestData)}` : '';
        this.logger.debug(
          `Lock released: ${lockKey} (method: ${parsedValue?.methodName}, user: ${parsedValue?.userId}${requestInfo})`,
        );
      }

      return released;
    } catch (error) {
      this.logger.error(`Failed to release lock ${lockKey}: ${error.message}`);
      return false;
    }
  }

  /**
   * 재시도를 포함한 락 획득
   * @param key 락 키
   * @param lockValue 락 소유자 식별 값
   * @param options 락 옵션
   * @returns 락 획득 성공 여부
   */
  async tryAcquireLock(key: string, lockValue: string, options: LockOptions = {}): Promise<boolean> {
    const { ttlSeconds = 5, retryAttempts = 3, retryDelayMs = 100 } = options;

    for (let attempt = 1; attempt <= retryAttempts; attempt++) {
      const acquired = await this.acquireLock(key, lockValue, ttlSeconds);

      if (acquired) {
        return true;
      }

      if (attempt < retryAttempts) {
        this.logger.debug(
          `Lock acquisition attempt ${attempt}/${retryAttempts} failed for ${key}, retrying in ${retryDelayMs}ms...`,
        );
        await this.delay(retryDelayMs * attempt); // 지수 백오프
      }
    }

    this.logger.warn(`Failed to acquire lock ${key} after ${retryAttempts} attempts`);
    return false;
  }

  /**
   * 락 TTL 연장
   * GET + TTL + EXPIRE 명령어 조합으로 처리
   * @param key 락 키
   * @param lockValue 락 소유자 식별 값
   * @param additionalSeconds 추가 TTL (초)
   * @returns 연장 성공 여부
   */
  async extendLock(key: string, lockValue: string, additionalSeconds: number): Promise<boolean> {
    const lockKey = `${this.lockPrefix}${key}`;

    try {
      // 1. 현재 락 값 확인
      const currentValue = await this.redis.get(lockKey);

      // 2. 락이 존재하지 않거나 값이 일치하지 않으면 연장 실패
      if (currentValue !== lockValue) {
        this.logger.warn(`Failed to extend lock ${lockKey}: value mismatch or lock not found`);
        return false;
      }

      // 3. 현재 TTL 확인
      const currentTtl = await this.redis.ttl(lockKey);

      // 4. TTL이 유효하지 않으면 연장 실패
      if (currentTtl <= 0) {
        this.logger.warn(`Failed to extend lock ${lockKey}: invalid TTL ${currentTtl}`);
        return false;
      }

      // 5. 새로운 TTL로 연장
      const newTtl = currentTtl + additionalSeconds;
      const extendResult = await this.redis.expire(lockKey, newTtl);
      const extended = extendResult === 1;

      if (extended) {
        const parsedValue = this.parseLockValue(lockValue);
        const requestInfo = parsedValue?.requestData ? `, data: ${JSON.stringify(parsedValue.requestData)}` : '';
        this.logger.debug(
          `Lock TTL extended for ${lockKey}: ${currentTtl}s → ${newTtl}s (method: ${parsedValue?.methodName}, user: ${parsedValue?.userId}${requestInfo})`,
        );
      }

      return extended;
    } catch (error) {
      this.logger.error(`Failed to extend lock ${lockKey}: ${error.message}`);
      return false;
    }
  }

  /**
   * 락 존재 여부 확인
   * @param key 락 키
   * @returns 락 존재 여부
   */
  async isLocked(key: string): Promise<boolean> {
    const lockKey = `${this.lockPrefix}${key}`;

    try {
      const exists = await this.redis.exists(lockKey);
      return exists === 1;
    } catch (error) {
      this.logger.error(`Failed to check lock ${lockKey}: ${error.message}`);
      return false;
    }
  }

  /**
   * 락 값 조회 (디버깅용)
   * @param key 락 키
   * @returns 락 값 또는 null
   */
  async getLockValue(key: string): Promise<string | null> {
    const lockKey = `${this.lockPrefix}${key}`;

    try {
      return await this.redis.get(lockKey);
    } catch (error) {
      this.logger.error(`Failed to get lock value ${lockKey}: ${error.message}`);
      return null;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 락 값 생성 헬퍼 메서드 (객체 형태)
   * @param methodName 메서드명
   * @param userId 사용자 ID (옵션)
   * @param requestData 요청 데이터 (옵션)
   * @returns JSON 형태의 락 값
   */
  generateLockValue(methodName: string, userId?: number, requestData?: Record<string, any>): string {
    const lockValue: LockValue = {
      methodName,
      userId,
      timestamp: dayjs().format('YYYY-MM-DD_HH:mm:ss.SSS'),
      requestData,
    };

    return JSON.stringify(lockValue);
  }

  /**
   * 락 값 파싱 헬퍼 메서드
   * @param lockValueString JSON 문자열 형태의 락 값
   * @returns 파싱된 락 값 객체 또는 null
   */
  parseLockValue(lockValueString: string): LockValue | null {
    try {
      return JSON.parse(lockValueString) as LockValue;
    } catch (error) {
      this.logger.warn(`Failed to parse lock value: ${lockValueString}`);
      return null;
    }
  }
}
