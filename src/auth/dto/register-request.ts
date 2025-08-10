import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';

export class RegisterRequest {
  @ApiProperty({
    description: '사용자 이름',
    example: '김철수',
    minLength: 2,
    maxLength: 30,
  })
  @IsString()
  @IsNotEmpty({ message: '이름은 필수 입력값입니다.' })
  @MinLength(2, { message: '이름은 최소 2글자 이상이어야 합니다.' })
  @MaxLength(30, { message: '이름은 최대 30글자까지 입력 가능합니다.' })
  name: string;
}
