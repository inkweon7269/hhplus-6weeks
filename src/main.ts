import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
// typeorm-transactional 초기화를 위한 import 추가
import { initializeTransactionalContext } from 'typeorm-transactional';

async function bootstrap() {
  // typeorm-transactional 컨텍스트 초기화 (앱 생성 전에 실행)
  initializeTransactionalContext();

  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      whitelist: true,
    }),
  );

  // Swagger 설정
  const config = new DocumentBuilder()
    .setTitle('E-Commerce API')
    .setDescription('이커머스 상품 주문 서비스 API')
    .setVersion('1.0')
    .addTag('상품 관리', '상품 조회 관련 API')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(3000);
}
bootstrap();
