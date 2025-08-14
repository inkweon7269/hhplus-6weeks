import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import * as dayjs from 'dayjs';

export interface LockOptions {
  ttlSeconds?: number;
  retryAttempts?: number;
  retryDelayMs?: number;
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
      // Lua 스크립트를 사용하여 원자적으로 SET NX EX 수행
      const luaScript = `
        if redis.call("EXISTS", KEYS[1]) == 0 then
          redis.call("SET", KEYS[1], ARGV[1], "EX", ARGV[2])
          return 1
        else
          return 0
        end
      `;

      const result = (await this.redis.eval(luaScript, 1, lockKey, lockValue, ttlSeconds)) as number;

      const acquired = result === 1;

      if (acquired) {
        this.logger.debug(`Lock acquired: ${lockKey} with value ${lockValue}`);
      }

      return acquired;
    } catch (error) {
      this.logger.error(`Failed to acquire lock ${lockKey}: ${error.message}`);
      return false;
    }
  }

  /**
   * Redis Simple Lock 해제
   * Lua 스크립트를 사용하여 원자적으로 처리
   * @param key 락 키
   * @param lockValue 락 소유자 식별 값
   * @returns 락 해제 성공 여부
   */
  async releaseLock(key: string, lockValue: string): Promise<boolean> {
    const lockKey = `${this.lockPrefix}${key}`;

    // Lua 스크립트: 값이 일치할 때만 삭제
    const luaScript = `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("DEL", KEYS[1])
      else
        return 0
      end
    `;

    try {
      const result = (await this.redis.eval(luaScript, 1, lockKey, lockValue)) as number;

      const released = result === 1;

      if (released) {
        this.logger.debug(`Lock released: ${lockKey}`);
      } else {
        this.logger.warn(`Failed to release lock ${lockKey}: value mismatch or lock not found`);
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
   * @param key 락 키
   * @param lockValue 락 소유자 식별 값
   * @param additionalSeconds 추가 TTL (초)
   * @returns 연장 성공 여부
   */
  async extendLock(key: string, lockValue: string, additionalSeconds: number): Promise<boolean> {
    const lockKey = `${this.lockPrefix}${key}`;

    // Lua 스크립트: 값이 일치하고 키가 존재할 때만 TTL 연장
    const luaScript = `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        local currentTtl = redis.call("TTL", KEYS[1])
        if currentTtl > 0 then
          return redis.call("EXPIRE", KEYS[1], currentTtl + ARGV[2])
        end
      end
      return 0
    `;

    try {
      const result = (await this.redis.eval(luaScript, 1, lockKey, lockValue, additionalSeconds)) as number;

      const extended = result === 1;

      if (extended) {
        this.logger.debug(`Lock TTL extended for ${lockKey}`);
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
   * 락 값 생성 헬퍼 메서드
   * @param methodName 메서드명
   * @param userId 사용자 ID (옵션)
   * @returns 포맷팅된 락 값
   */
  generateLockValue(methodName: string, userId?: number): string {
    const timestamp = dayjs().format('YYYY-MM-DD_HH:mm:ss.SSS');
    return userId ? `${methodName}:${userId}:${timestamp}` : `${methodName}:${timestamp}`;
  }
}
