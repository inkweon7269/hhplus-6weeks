import { Controller, Post, Body, Res, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { AuthFacade } from './auth.facade';
import { LoginRequest, LoginResponse, RegisterRequest } from './dto';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('인증')
@Controller('auth')
export class AuthController {
  constructor(private readonly authFacade: AuthFacade) {}

  @ApiOperation({
    summary: '로그인',
    description: 'name을 입력하여 로그인합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '로그인 성공',
    type: LoginResponse,
  })
  @Post('login')
  async login(@Body() loginRequest: LoginRequest, @Res() res: Response): Promise<Response<LoginResponse>> {
    const loginResult = await this.authFacade.login(loginRequest);
    res.setHeader('id', loginResult.id);
    return res.status(HttpStatus.OK).json(loginResult);
  }

  @ApiOperation({
    summary: '회원가입',
    description: '새 사용자를 등록하고 잔액을 0원으로 초기화합니다.',
  })
  @ApiResponse({
    status: 201,
    description: '회원가입 성공',
  })
  @Post('register')
  async register(@Body() registerRequest: RegisterRequest) {
    return await this.authFacade.register(registerRequest);
  }
}
