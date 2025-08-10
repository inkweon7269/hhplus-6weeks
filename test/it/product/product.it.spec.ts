import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { getTestDatasource } from '../setup';
import { AppModule } from '../../../src/app.module';
import { IProductRepository, PRODUCT_REPOSITORY } from '../../../src/product/domain/product.repository.interface';
import {
  IProductSalesDailyRepository,
  PRODUCT_SALES_DAILY_REPOSITORY,
} from '../../../src/product/domain/product-sales-daily.repository.interface';
import { getDataSourceToken } from '@nestjs/typeorm';

describe('Product Integration Test (IT)', () => {
  let app: INestApplication;
  let productRepository: IProductRepository;
  let productSalesDailyRepository: IProductSalesDailyRepository;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(getDataSourceToken())
      .useValue(getTestDatasource())
      .compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
        whitelist: true,
      }),
    );

    productRepository = moduleFixture.get<IProductRepository>(PRODUCT_REPOSITORY);
    productSalesDailyRepository = moduleFixture.get<IProductSalesDailyRepository>(PRODUCT_SALES_DAILY_REPOSITORY);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /products', () => {
    it('상품 목록을 페이지네이션으로 조회합니다', async () => {
      // 테스트 데이터 생성
      const testProduct1 = await productRepository.saveProduct({
        name: '스마트폰',
      });

      const testProduct2 = await productRepository.saveProduct({
        name: '노트북',
      });

      const response = await request(app.getHttpServer()).get('/products?page=1&limit=10').expect(200);

      expect(response.body.list).toHaveLength(2);
      expect(response.body.totalCount).toBe(2);
      expect(response.body.currentPage).toBe(1);
      expect(response.body.totalPages).toBe(1);

      const product1 = response.body.list.find((p: any) => p.name === '스마트폰');
      expect(product1).toMatchObject({
        id: testProduct1.id,
        name: '스마트폰',
      });

      const product2 = response.body.list.find((p: any) => p.name === '노트북');
      expect(product2).toMatchObject({
        id: testProduct2.id,
        name: '노트북',
      });
    });
  });

  describe('GET /products/:id', () => {
    let testProduct: any;

    beforeEach(async () => {
      testProduct = await productRepository.saveProduct({
        name: '상세 조회 테스트 상품',
      });
    });

    it('존재하지 않는 상품 조회 시 404 에러를 반환합니다', async () => {
      const nonExistentProductId = 999;
      const response = await request(app.getHttpServer()).get(`/products/${nonExistentProductId}`).expect(404);

      expect(response.body.message).toBe(`ID가 '${nonExistentProductId}'인 상품을 찾을 수 없습니다.`);
    });

    it('상품 상세 정보를 조회합니다', async () => {
      const response = await request(app.getHttpServer()).get(`/products/${testProduct.id}`).expect(200);

      expect(response.body).toMatchObject({
        id: testProduct.id,
        name: '상세 조회 테스트 상품',
      });

      expect(response.body.productOptions).toHaveLength(2);

      const option1 = response.body.productOptions.find((o: any) => o.name === '128GB');
      expect(option1).toMatchObject({
        id: expect.any(Number),
        name: '128GB',
        price: 800000,
        stock: 50,
      });

      const option2 = response.body.productOptions.find((o: any) => o.name === '256GB');
      expect(option2).toMatchObject({
        id: expect.any(Number),
        name: '256GB',
        price: 900000,
        stock: 30,
      });
    });
  });

  describe('GET /products/top-selling', () => {
    let testProduct1: any;
    let testProduct2: any;

    beforeEach(async () => {
      // 테스트 상품 생성
      testProduct1 = await productRepository.saveProduct({
        name: '인기 상품 1',
      });

      testProduct2 = await productRepository.saveProduct({
        name: '인기 상품 2',
      });

      // 판매 데이터 생성
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD 형식
      await productSalesDailyRepository.saveDailySales(testProduct1.id, today, 5);

      await productSalesDailyRepository.saveDailySales(testProduct2.id, today, 3);

      // 어제 판매 데이터도 추가
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      await productSalesDailyRepository.saveDailySales(testProduct1.id, yesterdayStr, 2);
    });

    it('인기 상품 목록을 조회합니다', async () => {
      const response = await request(app.getHttpServer()).get('/products/top-selling').expect(200);

      expect(response.body.products).toHaveLength(2);
      expect(response.body.products[0]).toMatchObject({
        productId: testProduct1.id,
        productName: '인기 상품 1',
        totalSales: 7, // 오늘 5 + 어제 2
        rank: 1,
      });
      expect(response.body.products[1]).toMatchObject({
        productId: testProduct2.id,
        productName: '인기 상품 2',
        totalSales: 3,
        rank: 2,
      });
    });

    it('판매 데이터가 없을 때 빈 배열을 반환합니다', async () => {
      // 과거 날짜로 cutoff를 설정하여 모든 데이터 삭제
      const farFuture = new Date();
      farFuture.setFullYear(farFuture.getFullYear() + 1);
      await productSalesDailyRepository.deleteOldData(farFuture);

      const response = await request(app.getHttpServer()).get('/products/top-selling').expect(200);

      expect(response.body.products).toHaveLength(0);
    });

    it('최대 5개까지만 반환합니다', async () => {
      // 추가 상품들 생성 (총 5개까지)
      const testProduct3 = await productRepository.saveProduct({
        name: '인기 상품 3',
      });
      const testProduct4 = await productRepository.saveProduct({
        name: '인기 상품 4',
      });
      const testProduct5 = await productRepository.saveProduct({
        name: '인기 상품 5',
      });
      const testProduct6 = await productRepository.saveProduct({
        name: '인기 상품 6',
      });

      const today = new Date().toISOString().split('T')[0];
      await productSalesDailyRepository.saveDailySales(testProduct3.id, today, 4);
      await productSalesDailyRepository.saveDailySales(testProduct4.id, today, 2);
      await productSalesDailyRepository.saveDailySales(testProduct5.id, today, 1);
      await productSalesDailyRepository.saveDailySales(testProduct6.id, today, 0);

      const response = await request(app.getHttpServer()).get('/products/top-selling').expect(200);

      // 6개 상품이 있지만 최대 5개만 반환되어야 함
      expect(response.body.products).toHaveLength(5);
      expect(response.body.products[0].rank).toBe(1);
      expect(response.body.products[1].rank).toBe(2);
      expect(response.body.products[2].rank).toBe(3);
      expect(response.body.products[3].rank).toBe(4);
      expect(response.body.products[4].rank).toBe(5);
    });
  });
});
