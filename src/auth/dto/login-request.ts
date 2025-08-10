import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class LoginRequest {
  @ApiProperty({
    description: '사용자 이름',
    example: '김철수',
  })
  @IsString()
  @IsNotEmpty({ message: '이름은 필수 입력값입니다.' })
  name: string;
}
