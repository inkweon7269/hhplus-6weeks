import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

@Injectable()
export class RedisCacheService {
  private readonly DEFAULT_TTL = 600; // 10분
  private cacheRedis: Redis;

  constructor(@InjectRedis() private readonly redis: Redis) {
    // 캐시용 Redis 연결 생성 (DB 1)
    this.cacheRedis = this.redis.duplicate();
    this.cacheRedis.select(1);
  }

  /**
   * 캐시에서 데이터 조회
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const cachedData = await this.cacheRedis.get(key);

      if (cachedData) {
        return JSON.parse(cachedData) as T;
      }

      return null;
    } catch (error) {
      // 캐시 조회 실패 시 null 반환 (원본 데이터 조회로 fallback)
      console.error('Redis cache get error:', error);
      return null;
    }
  }

  /**
   * 캐시에 데이터 저장 (TTL 설정)
   */
  async set(key: string, value: any, ttl: number = this.DEFAULT_TTL): Promise<void> {
    try {
      await this.cacheRedis.setex(key, ttl, JSON.stringify(value));
    } catch (error) {
      // 캐시 저장 실패 시 로그만 남기고 계속 진행
      console.error('Redis cache set error:', error);
    }
  }

  /**
   * 캐시에 데이터 저장 (TTL 없음)
   */
  async setNx(key: string, value: any): Promise<void> {
    try {
      await this.cacheRedis.set(key, JSON.stringify(value));
    } catch (error) {
      console.error('Redis cache setNx error:', error);
    }
  }

  /**
   * 특정 키 삭제
   */
  async del(key: string): Promise<void> {
    try {
      await this.cacheRedis.del(key);
    } catch (error) {
      console.error('Redis cache del error:', error);
    }
  }

  /**
   * 패턴 매칭으로 여러 키 삭제
   */
  async delPattern(pattern: string): Promise<void> {
    try {
      const keys = await this.cacheRedis.keys(pattern);

      if (keys.length > 0) {
        await this.cacheRedis.del(...keys);
      }
    } catch (error) {
      console.error('Redis cache pattern deletion error:', error);
    }
  }

  /**
   * 키 존재 여부 확인
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.cacheRedis.exists(key);
      return result === 1;
    } catch (error) {
      console.error('Redis cache exists error:', error);
      return false;
    }
  }

  /**
   * TTL 설정
   */
  async expire(key: string, ttl: number): Promise<void> {
    try {
      await this.cacheRedis.expire(key, ttl);
    } catch (error) {
      console.error('Redis cache expire error:', error);
    }
  }

  /**
   * 증가 연산 (숫자 값)
   */
  async incr(key: string): Promise<number> {
    try {
      return await this.cacheRedis.incr(key);
    } catch (error) {
      console.error('Redis cache incr error:', error);
      return 0;
    }
  }

  /**
   * 감소 연산 (숫자 값)
   */
  async decr(key: string): Promise<number> {
    try {
      return await this.cacheRedis.decr(key);
    } catch (error) {
      console.error('Redis cache decr error:', error);
      return 0;
    }
  }
}
