import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const UserId = createParamDecorator((data: unknown, ctx: ExecutionContext): number => {
  const request = ctx.switchToHttp().getRequest();
  const userId = request.headers['id'];

  if (!userId) {
    throw new Error('사용자 ID가 헤더에 없습니다.');
  }
  const numberUserId = Number(userId);

  if (isNaN(numberUserId)) {
    throw new Error('헤더의 사용자 ID가 숫자가 아닙니다.');
  }
  return numberUserId;
});
