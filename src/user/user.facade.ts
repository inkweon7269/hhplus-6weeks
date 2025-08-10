import { Injectable } from '@nestjs/common';
import { UserService } from './user.service';
import { GetUserProfileResponse } from './dto';

@Injectable()
export class UserFacade {
  constructor(private readonly userService: UserService) {}

  async getUserProfile(userId: number): Promise<GetUserProfileResponse> {
    return this.userService.getUserProfile(userId);
  }
}
