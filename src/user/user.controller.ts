import { Controller, Get } from '@nestjs/common';
import { GetUserProfileResponse } from './dto';
import { UserId } from '../common/decorator/user-id.decorator';
import { UserFacade } from './user.facade';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('사용자')
@Controller('user')
export class UserController {
  constructor(private readonly userFacade: UserFacade) {}

  @ApiOperation({
    summary: '프로필 조회',
    description: '로그인한 사용자의 프로필 정보를 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '프로필 조회 성공',
    type: GetUserProfileResponse,
  })
  @Get('profile')
  async getUserProfile(@UserId() userId: number): Promise<GetUserProfileResponse> {
    return await this.userFacade.getUserProfile(userId);
  }
}
