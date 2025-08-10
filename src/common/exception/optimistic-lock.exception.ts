import { ConflictException } from '@nestjs/common';

export class OptimisticLockException extends ConflictException {
  constructor(message: string = '다른 사용자가 동시에 데이터를 수정하고 있습니다. 잠시 후 다시 시도해주세요.') {
    super(message);
    this.name = 'OptimisticLockException';
  }
}

export class ConcurrencyException extends ConflictException {
  constructor(message: string = '동시성 제어로 인해 요청이 실패했습니다. 잠시 후 다시 시도해주세요.') {
    super(message);
    this.name = 'ConcurrencyException';
  }
}

export class RetryExhaustedException extends ConflictException {
  constructor(
    maxAttempts: number,
    message: string = `최대 재시도 횟수(${maxAttempts})를 초과했습니다. 잠시 후 다시 시도해주세요.`
  ) {
    super(message);
    this.name = 'RetryExhaustedException';
  }
}