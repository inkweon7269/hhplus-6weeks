import { Logger } from '@nestjs/common';
import { RetryExhaustedException } from '../exception/optimistic-lock.exception';

export interface RetryOptions {
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryIf?: (error: any) => boolean;
}

const defaultOptions: Required<RetryOptions> = {
  maxAttempts: 3,
  baseDelay: 100,
  maxDelay: 1000,
  backoffMultiplier: 2,
  retryIf: (error: any) => error.message?.includes('낙관적 락 충돌'),
};

export function Retry(options: RetryOptions = {}) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    const logger = new Logger(`${target.constructor.name}.${propertyName}`);
    const config = { ...defaultOptions, ...options };

    descriptor.value = async function (...args: any[]) {
      let lastError: any;

      for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
        try {
          return await method.apply(this, args);
        } catch (error) {
          lastError = error;

          if (attempt === config.maxAttempts) {
            if (config.retryIf(error)) {
              throw new RetryExhaustedException(config.maxAttempts);
            } else {
              throw error;
            }
          }

          if (!config.retryIf(error)) {
            throw error;
          }

          const delay = Math.min(config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1), config.maxDelay);

          logger.warn(`시도 ${attempt}/${config.maxAttempts} 실패: ${error.message}. ${delay}ms 후 재시도...`);

          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }

      throw lastError;
    };

    return descriptor;
  };
}
