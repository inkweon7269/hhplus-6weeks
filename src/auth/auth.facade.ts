import { Injectable } from '@nestjs/common';
import { AuthService } from './auth.service';
import { BalanceService } from '../balance/balance.service';
import { LoginRequest, LoginResponse, RegisterRequest } from './dto';
import { Transactional } from 'typeorm-transactional';

@Injectable()
export class AuthFacade {
  constructor(
    private readonly authService: AuthService,
    private readonly balanceService: BalanceService,
  ) {}

  async login(loginRequest: LoginRequest): Promise<LoginResponse> {
    return this.authService.login(loginRequest);
  }

  @Transactional()
  async register(registerRequest: RegisterRequest) {
    const userResult = await this.authService.register(registerRequest);
    await this.balanceService.initializeBalance(userResult.id);
  }
}
