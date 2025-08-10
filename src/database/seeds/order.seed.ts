import { DataSource } from 'typeorm';
import { OrderEntity } from '../../order/domain/order.entity';
import { OrderProductEntity } from '../../order/domain/order-product.entity';
import { OrderProductOptionEntity } from '../../order/domain/order-product-option.entity';
import { OrderCouponEntity } from '../../order/domain/order-coupon.entity';
import { UserEntity } from '../../user/domain/user.entity';
import { UserCouponEntity } from '../../coupon/domain/user-coupon.entity';
import { CouponEntity } from '../../coupon/domain/coupon.entity';
import { ProductEntity } from '../../product/domain/product.entity';
import { ProductOptionEntity } from '../../product/domain/product-option.entity';

export async function seedOrders(dataSource: DataSource) {
  const orderRepository = dataSource.getRepository(OrderEntity);
  const orderProductRepository = dataSource.getRepository(OrderProductEntity);
  const orderProductOptionRepository = dataSource.getRepository(OrderProductOptionEntity);
  const orderCouponRepository = dataSource.getRepository(OrderCouponEntity);
  const userRepository = dataSource.getRepository(UserEntity);
  const userCouponRepository = dataSource.getRepository(UserCouponEntity);
  const couponRepository = dataSource.getRepository(CouponEntity);
  const productRepository = dataSource.getRepository(ProductEntity);
  const productOptionRepository = dataSource.getRepository(ProductOptionEntity);

  // Check if orders already exist
  const existingOrders = await orderRepository.find();
  if (existingOrders.length > 0) {
    console.log('Orders already seeded');
    return;
  }

  // Get existing users, products, and product options
  const users = await userRepository.find();
  const products = await productRepository.find();
  const productOptions = await productOptionRepository.find();
  const userCoupons = await userCouponRepository.find();
  const coupons = await couponRepository.find();

  if (users.length === 0) {
    console.log('No users found. Please seed users first.');
    return;
  }

  if (products.length === 0) {
    console.log('No products found. Please seed products first.');
    return;
  }

  // Create orders
  const orders = [
    {
      userId: users[0].id,
      totalPrice: 900000,
      status: 'CONFIRMED',
    },
    {
      userId: users[0].id,
      totalPrice: 1200000,
      status: 'PROCESSING',
    },
    {
      userId: users.length > 1 ? users[1].id : users[0].id,
      totalPrice: 200000,
      status: 'COMPLETED',
    },
    {
      userId: users.length > 1 ? users[1].id : users[0].id,
      totalPrice: 350000,
      status: 'CONFIRMED',
    },
    {
      userId: users[0].id,
      totalPrice: 600000,
      status: 'CANCELLED',
    },
  ];

  const savedOrders = await orderRepository.save(orders);

  // Create order coupons for orders that use coupons
  const orderCoupons = [];
  if (userCoupons.length > 0 && coupons.length > 0) {
    // Order 1 uses first user coupon
    orderCoupons.push({
      orderId: savedOrders[0].id,
      couponId: userCoupons[0].couponId,
      userCouponId: userCoupons[0].id,
      discountAmount: 5000, // Sample discount amount
    });

    // Order 4 uses second user coupon (if exists)
    if (userCoupons.length > 1) {
      orderCoupons.push({
        orderId: savedOrders[3].id,
        couponId: userCoupons[1].couponId,
        userCouponId: userCoupons[1].id,
        discountAmount: 10000, // Sample discount amount
      });
    }
  }

  if (orderCoupons.length > 0) {
    await orderCouponRepository.save(orderCoupons);
  }

  // Create order products
  const orderProducts = [
    // Order 1: 스마트폰 256GB
    {
      orderId: savedOrders[0].id,
      productId: products[0].id, // 스마트폰
      name: '스마트폰',
    },
    // Order 2: 노트북 15인치
    {
      orderId: savedOrders[1].id,
      productId: products[1].id, // 노트북
      name: '노트북',
    },
    // Order 3: 무선 이어폰 블랙
    {
      orderId: savedOrders[2].id,
      productId: products[2].id, // 무선 이어폰
      name: '무선 이어폰',
    },
    // Order 4: 스마트워치 44mm
    {
      orderId: savedOrders[3].id,
      productId: products[4].id, // 스마트워치
      name: '스마트워치',
    },
    // Order 5: 태블릿 64GB
    {
      orderId: savedOrders[4].id,
      productId: products[3].id, // 태블릿
      name: '태블릿',
    },
  ];

  const savedOrderProducts = await orderProductRepository.save(orderProducts);

  // Create order product options
  const orderProductOptions = [
    // Order 1: 스마트폰 256GB 옵션
    {
      orderProductId: savedOrderProducts[0].id,
      productOptionId: productOptions.find((po) => po.name === '256GB')?.id || productOptions[0].id,
      name: '256GB',
      price: 900000,
      quantity: 1,
    },
    // Order 2: 노트북 15인치 옵션
    {
      orderProductId: savedOrderProducts[1].id,
      productOptionId: productOptions.find((po) => po.name === '15인치')?.id || productOptions[2].id,
      name: '15인치',
      price: 1500000,
      quantity: 1,
    },
    // Order 3: 무선 이어폰 블랙 옵션
    {
      orderProductId: savedOrderProducts[2].id,
      productOptionId: productOptions.find((po) => po.name === '블랙')?.id || productOptions[4].id,
      name: '블랙',
      price: 200000,
      quantity: 1,
    },
    // Order 4: 스마트워치 44mm 옵션
    {
      orderProductId: savedOrderProducts[3].id,
      productOptionId: productOptions.find((po) => po.name === '44mm')?.id || productOptions[8].id,
      name: '44mm',
      price: 350000,
      quantity: 1,
    },
    // Order 5: 태블릿 64GB 옵션
    {
      orderProductId: savedOrderProducts[4].id,
      productOptionId: productOptions.find((po) => po.name === '64GB')?.id || productOptions[6].id,
      name: '64GB',
      price: 600000,
      quantity: 1,
    },
  ];

  await orderProductOptionRepository.save(orderProductOptions);
  console.log('Orders seeded successfully');
}
