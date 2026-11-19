import type { Translate } from '../language';
import type { Category, Order, OrderItem } from '../types';

export function categoryLabels(t: Translate): Record<Category, string> {
  return {
    FOOD: t('猫粮狗粮', 'Pet food', '貓糧狗糧'),
    WELLNESS: t('宠物保健', 'Pet wellness', '寵物保健'),
    BOWLS: t('喂食用品', 'Feeding accessories', '餵食用品'),
    FRAMES: t('定制相框', 'Custom frames', '訂製相架'),
    KEEPSAKES: t('纪念挂饰', 'Keepsake charms', '紀念掛飾'),
    URNS: t('纪念盒', 'Memorial urns', '紀念盒'),
  };
}

export function orderStatusLabels(t: Translate): Record<Order['status'], string> {
  return {
    PENDING_PAYMENT: t('待付款', 'Awaiting payment', '待付款'),
    PAID: t('已付款', 'Paid', '已付款'),
    PARTIALLY_SHIPPED: t('部分已发货', 'Partially shipped', '部分已寄出'),
    SHIPPED: t('已发货', 'Shipped', '已寄出'),
    COMPLETED: t('已完成', 'Completed', '已完成'),
    CANCELLED: t('已取消', 'Cancelled', '已取消'),
    REFUND_REQUESTED: t('退款审核中', 'Refund under review', '退款審核中'),
    REFUNDED: t('已退款', 'Refunded', '已退款'),
  };
}

export function productionLabels(t: Translate): Record<NonNullable<OrderItem['productionStatus']>, string> {
  return {
    AWAITING_PAYMENT: t('付款后制作', 'Made after payment', '付款後製作'),
    QUEUED: t('等待制作', 'Queued for production', '等候製作'),
    IN_PRODUCTION: t('制作中', 'In production', '製作中'),
    READY: t('制作完成', 'Production complete', '製作完成'),
    CANCELLED: t('已取消制作', 'Production cancelled', '已取消製作'),
    NOT_REQUIRED: '',
  };
}

export function careLabels(t: Translate) {
  return {
    species: { ALL: t('猫狗通用', 'Cats and dogs', '貓狗適用'), CAT: t('猫', 'Cat', '貓'), DOG: t('狗', 'Dog', '狗') },
    stages: {
      ALL: t('全年龄', 'All ages', '全年齡'), YOUNG: t('幼年', 'Young', '幼年'),
      ADULT: t('成年', 'Adult', '成年'), SENIOR: t('老年', 'Senior', '年長'),
    },
  };
}
