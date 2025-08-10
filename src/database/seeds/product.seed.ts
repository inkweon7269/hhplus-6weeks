import { DataSource } from 'typeorm';
import { ProductEntity } from '../../product/domain/product.entity';
import { ProductOptionEntity } from '../../product/domain/product-option.entity';

export async function seedProducts(dataSource: DataSource) {
  const productRepository = dataSource.getRepository(ProductEntity);
  const productOptionRepository = dataSource.getRepository(ProductOptionEntity);

  // Check if products already exist
  const existingProducts = await productRepository.find();
  if (existingProducts.length > 0) {
    console.log('Products already seeded');
    return;
  }

  // Create products
  const products = [
    { name: '스마트폰' },
    { name: '노트북' },
    { name: '무선 이어폰' },
    { name: '태블릿' },
    { name: '스마트워치' },
    { name: '블루투스 스피커' },
    { name: '키보드' },
  ];

  const savedProducts = await productRepository.save(products);

  // Create product options
  const productOptions = [
    // 스마트폰 옵션
    { name: '128GB', price: 800000, stock: 30, product: savedProducts[0] },
    { name: '256GB', price: 900000, stock: 20, product: savedProducts[0] },
    
    // 노트북 옵션
    { name: '13인치', price: 1200000, stock: 15, product: savedProducts[1] },
    { name: '15인치', price: 1500000, stock: 15, product: savedProducts[1] },
    
    // 무선 이어폰 옵션
    { name: '블랙', price: 200000, stock: 50, product: savedProducts[2] },
    { name: '화이트', price: 200000, stock: 50, product: savedProducts[2] },
    
    // 태블릿 옵션
    { name: '64GB', price: 600000, stock: 25, product: savedProducts[3] },
    
    // 스마트워치 옵션
    { name: '40mm', price: 300000, stock: 40, product: savedProducts[4] },
    { name: '44mm', price: 350000, stock: 40, product: savedProducts[4] },
    
    // 블루투스 스피커 옵션
    { name: '포터블', price: 150000, stock: 60, product: savedProducts[5] },
    
    // 키보드 옵션
    { name: '유선', price: 100000, stock: 20, product: savedProducts[6] },
    { name: '무선', price: 120000, stock: 20, product: savedProducts[6] },
  ];

  await productOptionRepository.save(productOptions);
  console.log('Products seeded successfully');
}