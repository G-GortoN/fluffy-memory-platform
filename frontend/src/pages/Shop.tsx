import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Input, InputNumber, Radio } from 'antd';
import { SearchOutlined, ShoppingOutlined } from '@ant-design/icons';
import { api, ApiError } from '../api';
import { loginLink, useSession } from '../auth';
import { useLanguage } from '../language';
import { categoryLabels } from '../locales/commerce';
import { localizeSeedText } from '../localized-content';
import { cartKey } from '../queries';
import type { Category, CartItem, DirectCheckout, Product, PurchaseItem } from '../types';
import { ButtonLink, EmptyState, Feedback, formatPrice, Loading, MediaImage, PageIntro, PhotoInput } from '../ui';

const memoriesCategories: Category[] = ['FRAMES', 'KEEPSAKES', 'URNS'];

export function Shop() {
  const { t, locale } = useLanguage();
  const [params, setParams] = useSearchParams();
  const labels = categoryLabels(t);
  const categories = Object.keys(labels) as Category[];
  const category = params.get('category');
  const query = params.get('q') ?? '';
  const collection = params.get('collection') === 'memory';
  const searchParams = new URLSearchParams();
  if (category) searchParams.set('category', category);
  const result = useQuery({ queryKey: ['products', 'list', category], queryFn: () => api<Product[]>(`/products?${searchParams}`) });
  const keyword = query.trim().toLocaleLowerCase(locale);
  const products = result.data?.filter(product => {
    if (collection && !memoriesCategories.includes(product.category)) return false;
    if (!keyword) return true;
    const fields = [product.name, product.description, labels[product.category], ...product.variants.map(variant => variant.name)];
    return fields.some(value => [value, localizeSeedText(value, locale)].some(text => text.toLocaleLowerCase(locale).includes(keyword)));
  });
  function update(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next, { replace: true });
  }
  return <main className="page-shell shop-page">
    <PageIntro title={collection ? t('纪念用品', 'Memorial collection', '紀念用品') : t('周边商城', 'Shop', '精品商店')} description={collection ? t('把名字和照片做成可以留在身边的纪念。', 'Turn a name or photo into a keepsake you can keep close.', '將名字和相片製成可以留在身邊的紀念。') : t('从照护日常，到留下一份纪念。', 'Find everyday essentials and keepsakes for the moments you want to remember.', '從日常照顧用品，到值得珍藏的紀念。')}>
      {collection && <ButtonLink to="/shop" secondary>{t('浏览全部商品', 'Browse all products', '瀏覽所有商品')}</ButtonLink>}
    </PageIntro>
    <div className="shop-controls">
      <div className="category-filter" aria-label={t('商品分类', 'Product categories', '商品分類')}>
        <button className={!category ? 'selected' : ''} type="button" aria-pressed={!category} onClick={() => update('category', '')}>{t('全部', 'All', '全部')}</button>
        {(collection ? memoriesCategories : categories).map(key => <button key={key} className={category === key ? 'selected' : ''} type="button" aria-pressed={category === key} onClick={() => update('category', key)}>{labels[key]}</button>)}
      </div>
      <form className="catalog-search" role="search" onSubmit={event => {
        event.preventDefault();
        update('q', String(new FormData(event.currentTarget).get('query') || '').trim());
      }}>
        <Input key={query} name="query" defaultValue={query} allowClear placeholder={t('搜索商品', 'Search products', '搜尋商品')} aria-label={t('搜索商品', 'Search products', '搜尋商品')} />
        <Button htmlType="submit" icon={<SearchOutlined />} aria-label={t('搜索', 'Search', '搜尋')} />
      </form>
    </div>
    <Feedback error={result.error} />
    {result.isPending && <Loading />}
    {products?.length === 0 && <EmptyState title={t('没有找到商品', 'No products found', '未找到商品')} description={t('试试其他关键词，或换一个商品分类。', 'Try a different search term or product category.', '試試其他關鍵字，或選擇另一個商品分類。')} />}
    <div className="product-grid">{products?.map(product => {
      const price = product.variants.length ? formatPrice(Math.min(...product.variants.map(variant => variant.priceCents)), locale) : null;
      return <Link className="product-card" key={product.id} to={`/shop/${product.id}`}>
        <MediaImage src={product.imageUrl} alt="" className="product-image" />
        <div className="product-copy"><span className="product-category">{labels[product.category]}</span><h2>{localizeSeedText(product.name, locale)}</h2>
          {price && <p>{product.variants.length > 1 ? t(`${price} 起`, `From ${price}`, `${price} 起`) : price}</p>}
        </div>
      </Link>;
    })}</div>
  </main>;
}

export function ProductDetail() {
  const { t } = useLanguage();
  const { productId } = useParams();
  const result = useQuery({ queryKey: ['products', Number(productId)], queryFn: () => api<Product>(`/products/${productId}`) });
  if (result.isPending) return <main className="page-shell"><Loading /></main>;
  if (result.error instanceof ApiError && result.error.status === 404) return <main className="page-shell"><EmptyState title={t('这件商品暂不可购买', 'This product is currently unavailable', '這件商品暫時無法購買')}><ButtonLink to="/shop">{t('返回商城', 'Back to shop', '返回商店')}</ButtonLink></EmptyState></main>;
  if (result.error) return <main className="page-shell"><Feedback error={result.error} /></main>;
  return <ProductPurchase key={result.data.id} product={result.data} />;
}

function ProductPurchase({ product }: { product: Product }) {
  const { t, locale } = useLanguage();
  const productName = localizeSeedText(product.name, locale);
  const [variantId, setVariantId] = useState(product.variants.find(variant => variant.stock > 0)?.id ?? product.variants[0]?.id);
  const [quantity, setQuantity] = useState(1);
  const [customText, setCustomText] = useState('');
  const [customPhotoUrl, setCustomPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [added, setAdded] = useState(false);
  const client = useQueryClient();
  const { data: account, error: accountError } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const selected = product.variants.find(variant => variant.id === variantId);
  const add = useMutation({
    mutationFn: (item: PurchaseItem) => api<CartItem>('/cart', 'POST', item),
    onSuccess: async () => {
      setAdded(true);
      await client.invalidateQueries({ queryKey: cartKey });
    },
  });
  const available = product.active && selected && selected.stock >= quantity;
  const customReady = !product.custom || Boolean(customText.trim() || customPhotoUrl);
  function select(mode: 'cart' | 'direct') {
    if (!account || !selected || !available || !customReady) return;
    const item: PurchaseItem = { variantId: selected.id, quantity };
    if (product.custom) {
      item.customText = customText.trim();
      item.customPhotoUrl = customPhotoUrl;
    }
    if (mode === 'cart') add.mutate(item);
    else {
      const checkout: DirectCheckout = { accountId: account.id, item, productName: product.name, variantName: selected.name };
      navigate('/checkout', { state: checkout });
    }
  }
  return <main className="page-shell">
    <Link className="back-link" to="/shop">{t('返回商城', 'Back to shop', '返回商店')}</Link>
    <div className="product-detail">
      <MediaImage src={product.imageUrl} alt={productName} className="product-detail-photo" />
      <section className="product-detail-copy">
        <Link className="product-category" to={`/shop?category=${product.category}`}>{categoryLabels(t)[product.category]}</Link>
        <h1>{productName}</h1><p className="prose">{localizeSeedText(product.description, locale)}</p>
        {selected && <p className="detail-price">{formatPrice(selected.priceCents, locale)}</p>}
        <Feedback error={add.error || accountError} success={added ? t('已加入购物袋', 'Added to your bag', '已加入購物袋') : undefined} />
        {!!product.variants.length && <fieldset className="form-fieldset purchase-fieldset"><legend>{t('规格', 'Options', '規格')}</legend>
          <Radio.Group value={variantId} onChange={event => { setVariantId(event.target.value); setQuantity(1); setAdded(false); }}>
            {product.variants.map(variant => <Radio.Button key={variant.id} value={variant.id}>{localizeSeedText(variant.name, locale)}</Radio.Button>)}
          </Radio.Group>
        </fieldset>}
        {selected && <div className="purchase-quantity"><label htmlFor="purchase-quantity">{t('数量', 'Quantity', '數量')}</label><InputNumber id="purchase-quantity" value={quantity} min={1} max={Math.max(1, Math.min(99, selected.stock))} precision={0} onChange={value => { setQuantity(value || 1); setAdded(false); }} /><span>{selected.stock ? t(`库存 ${selected.stock} 件`, `${selected.stock} in stock`, `庫存 ${selected.stock} 件`) : t('当前规格已售罄', 'This option is sold out', '此規格已售罄')}</span></div>}
        {product.custom && <fieldset className="form-fieldset purchase-fieldset"><legend>{t('定制内容', 'Personalization', '訂製內容')}</legend>
          <p className="form-hint">{t('填写定制文字或上传一张照片。请在付款前确认。', 'Enter your custom text or upload a photo, then check it before paying.', '輸入訂製文字或上載一張相片，並於付款前確認。')}</p>
          <Input aria-label={t('定制文字', 'Custom text', '訂製文字')} placeholder={t('例如：小栗子', 'For example, Chestnut', '例如小栗子')} maxLength={120} value={customText} onChange={event => setCustomText(event.target.value)} />
          {account && <PhotoInput value={customPhotoUrl} onChange={setCustomPhotoUrl} label={t('上传定制照片', 'Upload a photo', '上載訂製相片')} onBusy={setUploading} />}
        </fieldset>}
        {account ? <div className="order-actions purchase-actions">
          <Button type="primary" icon={<ShoppingOutlined />} disabled={!available || !customReady || uploading} loading={add.isPending} onClick={() => select('cart')}>{t('加入购物袋', 'Add to bag', '加入購物袋')}</Button>
          <Button disabled={!available || !customReady || uploading || add.isPending} onClick={() => select('direct')}>{t('立即购买', 'Buy now', '立即購買')}</Button>
          {added && <Link className="text-link" to="/cart">{t('查看购物袋', 'View bag', '查看購物袋')}</Link>}
        </div> : <ButtonLink to={loginLink(location.pathname)}>{t('登录后购买', 'Sign in to buy', '登入後購買')}</ButtonLink>}
        <dl className="purchase-policy">
          <dt>{t('参考发货时间', 'Estimated dispatch', '預計寄出時間')}</dt>
          <dd>{product.custom
            ? t('付款后开始排单制作，参考发货时间为 3–7 个工作日。实际进度可在订单中查看。', 'Custom items typically dispatch within 3–7 business days after payment. Check your order for updates.', '付款後會排期製作，預計於 3–7 個工作天內寄出。你可在訂單中查看進度。')
            : t('付款后参考发货时间为 1–3 个工作日。实际进度可在订单中查看。', 'Items typically dispatch within 1–3 business days after payment. Check your order for updates.', '付款後預計於 1–3 個工作天內寄出。你可在訂單中查看進度。')}</dd>
          <dt>{t('取消与退款', 'Cancellations and refunds', '取消及退款')}</dt>
          <dd>{product.custom
            ? t('待付款订单可取消。付款后可申请退款，运营将核对制作和发货进度。', 'Cancel an unpaid order at any time. After payment, you can request a refund. The team will review the production and dispatch status.', '待付款的訂單可以取消。付款後可申請退款，團隊會核對製作及寄出進度。')
            : t('待付款订单可取消。付款后可在订单详情中提交退款申请，由运营审核。', 'Cancel an unpaid order at any time. After payment, request a refund from your order details for review.', '待付款的訂單可以取消。付款後可在訂單詳情提交退款申請，由團隊審核。')}</dd>
        </dl>
      </section>
    </div>
  </main>;
}
