import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { UserFacade } from './user.facade';
import { UserEntity } from './domain/user.entity';
import { UserRepository } from './domain/user.repository';
import { USER_REPOSITORY } from './domain/user.repository.interface';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity])],
  controllers: [UserController],
  providers: [
    UserService,
    UserFacade,
    {
      provide: USER_REPOSITORY,
      useClass: UserRepository, // Symbol 토큰을 사용한 인터페이스에 구현체 바인딩
    },
  ],
  exports: [UserFacade, USER_REPOSITORY],
})
export class UserModule {}
