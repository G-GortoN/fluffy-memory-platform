export interface Account {
  id: number;
  email: string;
  name: string;
  role: 'ADMIN' | 'CUSTOMER';
}

export interface Pet {
  id: number;
  name: string;
  species: 'CAT' | 'DOG';
  breed: string | null;
  ageMonths: number;
  weightKg: number | null;
  status: 'ACTIVE' | 'DECEASED';
  photoUrl: string | null;
}

export interface Care {
  id: number;
  title: string;
  summary: string;
  body: string;
  sourceUrl: string | null;
  productId: number | null;
}

export interface CareRule extends Care {
  species: 'ALL' | Pet['species'];
  stage: 'ALL' | 'YOUNG' | 'ADULT' | 'SENIOR';
  breed: string | null;
  published: boolean;
}

export interface Memorial {
  id: number;
  petId: number | null;
  petName: string;
  title: string;
  story: string;
  template: 'CORNER' | 'HALL';
  photoUrl: string | null;
  shareEnabled: boolean;
  timeline: { date: string; text: string }[];
  gallery: string[];
}

export const categoryNames = {
  FOOD: '猫粮狗粮',
  WELLNESS: '宠物保健',
  BOWLS: '喂食用品',
  FRAMES: '定制相框',
  KEEPSAKES: '纪念挂饰',
  URNS: '纪念盒',
};
export type Category = keyof typeof categoryNames;

export interface Variant {
  id: number;
  name: string;
  priceCents: number;
  stock: number;
}

export interface Product {
  id: number;
  name: string;
  description: string;
  category: Category;
  imageUrl: string | null;
  custom: boolean;
  active: boolean;
  variants: Variant[];
}

export interface PurchaseItem {
  variantId: number;
  quantity: number;
  customText?: string;
  customPhotoUrl?: string | null;
}

export interface DirectCheckout {
  accountId: number;
  item: PurchaseItem;
  productName: string;
  variantName: string;
}

export interface CartItem extends PurchaseItem {
  id: number;
  productId: number;
  productName: string;
  variantName: string;
  priceCents: number;
  imageUrl: string | null;
  stock: number;
  active: boolean;
  custom: boolean;
}

export interface OrderItem extends PurchaseItem {
  id: number;
  productId: number;
  productName: string;
  variantName: string;
  priceCents: number;
  productionStatus: 'AWAITING_PAYMENT' | 'QUEUED' | 'IN_PRODUCTION' | 'READY' | 'CANCELLED' | 'NOT_REQUIRED' | null;
  shipmentId: number | null;
}

export interface Shipment {
  id: number;
  carrier: string;
  trackingNo: string;
  shippedAt: string;
}

export const orderStatusNames = {
  PENDING_PAYMENT: '待付款',
  PAID: '已付款',
  PARTIALLY_SHIPPED: '部分已发货',
  SHIPPED: '已发货',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
  REFUND_REQUESTED: '退款审核中',
  REFUNDED: '已退款',
};

export interface Order {
  id: number;
  status: keyof typeof orderStatusNames;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  recipient: string;
  phone: string;
  address: string;
  createdAt: string;
  expiresAt: string | null;
  paidAt: string | null;
  refundReason: string | null;
  items: OrderItem[];
  shipments: Shipment[];
}
