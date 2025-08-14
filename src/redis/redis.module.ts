import { Module, Global } from '@nestjs/common';
import { RedisModule as IoRedisModule } from '@nestjs-modules/ioredis';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisLockService } from './redis-lock.service';

@Global()
@Module({
  imports: [
    IoRedisModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'single',
        options: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get('REDIS_PORT', 6380),
          password: configService.get('REDIS_PASSWORD'),
          db: configService.get('REDIS_DB', 0),
          retryStrategy: (times: number) => {
            // 재연결 전략: 최대 10번 시도, 지수 백오프
            if (times > 10) {
              return null; // 재연결 중단
            }
            return Math.min(times * 100, 3000); // 최대 3초 대기
          },
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
          lazyConnect: false,
        },
      }),
    }),
  ],
  providers: [RedisLockService],
  exports: [RedisLockService],
})
export class RedisModule {}