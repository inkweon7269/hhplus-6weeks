import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { IUserRepository, USER_REPOSITORY } from './domain/user.repository.interface';
import { GetUserProfileResponse } from './dto';

@Injectable()
export class UserService {
  constructor(
    @Inject(USER_REPOSITORY) // Symbol을 사용한 토큰 기반 의존성 주입
    private userRepository: IUserRepository,
  ) {}

  async getUserProfile(userId: number): Promise<GetUserProfileResponse> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new NotFoundException(`ID가 '${userId}'인 사용자를 찾을 수 없습니다.`);
    }

    return {
      id: user.id,
      name: user.name,
    };
  }
}
