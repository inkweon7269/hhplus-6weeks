import { Injectable, NotFoundException, Inject, BadRequestException } from '@nestjs/common';
import { LoginRequest, LoginResponse, RegisterRequest } from './dto';
import { IUserRepository, USER_REPOSITORY } from '../user/domain/user.repository.interface';

@Injectable()
export class AuthService {
  constructor(@Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository) {}

  async login(loginRequest: LoginRequest): Promise<LoginResponse> {
    const { name } = loginRequest;

    const user = await this.userRepository.findByName(name);

    if (!user) {
      throw new NotFoundException(`이름이 '${name}'인 사용자를 찾을 수 없습니다.`);
    }

    return {
      id: user.id,
      name: user.name,
    };
  }

  async register(registerRequest: RegisterRequest) {
    const { name } = registerRequest;

    const existingUser = await this.userRepository.findByName(name);

    if (existingUser) {
      throw new BadRequestException(`이름이 '${name}'인 사용자가 이미 존재합니다.`);
    }

    return await this.userRepository.save({ name });
  }
}
