import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthFacade } from './auth.facade';
import { UserModule } from '../user/user.module';
import { BalanceModule } from '../balance/balance.module';

@Module({
  imports: [UserModule, BalanceModule],
  controllers: [AuthController],
  providers: [AuthService, AuthFacade],
  exports: [AuthFacade],
})
export class AuthModule {}
