import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Input, InputNumber, Radio } from 'antd';
import { SearchOutlined, ShoppingOutlined } from '@ant-design/icons';
import { api, ApiError } from '../api';
import { loginLink, useSession } from '../auth';
import { cartKey } from '../queries';
import { categoryNames, type Category, type CartItem, type Product, type PurchaseItem } from '../types';
import { ButtonLink, EmptyState, Feedback, formatPrice, Loading, MediaImage, PageIntro, PhotoInput } from '../ui';

const memoriesCategories: Category[] = ['FRAMES', 'KEEPSAKES', 'URNS'];
const categories = Object.keys(categoryNames) as Category[];

export function Shop() {
  const [params, setParams] = useSearchParams();
  const category = params.get('category');
  const query = params.get('q') ?? '';
  const collection = params.get('collection') === 'memory';
  const searchParams = new URLSearchParams();
  if (category) searchParams.set('category', category);
  if (query) searchParams.set('q', query);
  const result = useQuery({ queryKey: ['products', 'list', category, query], queryFn: () => api<Product[]>(`/products?${searchParams}`) });
  const products = result.data?.filter(product => !collection || memoriesCategories.includes(product.category));
  function update(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next, { replace: true });
  }
  return <main className="page-shell shop-page">
    <PageIntro title={collection ? '纪念用品' : '周边商城'} description={collection ? '把名字和照片做成可以留在身边的纪念。' : '从照护日常，到留下一份纪念。'}>
      {collection && <ButtonLink to="/shop" secondary>浏览全部商品</ButtonLink>}
    </PageIntro>
    <div className="shop-controls">
      <div className="category-filter" aria-label="商品分类">
        <button className={!category ? 'selected' : ''} type="button" aria-pressed={!category} onClick={() => update('category', '')}>全部</button>
        {(collection ? memoriesCategories : categories).map(key => <button key={key} className={category === key ? 'selected' : ''} type="button" aria-pressed={category === key} onClick={() => update('category', key)}>{categoryNames[key]}</button>)}
      </div>
      <form className="catalog-search" role="search" onSubmit={event => {
        event.preventDefault();
        update('q', String(new FormData(event.currentTarget).get('query') || '').trim());
      }}>
        <Input key={query} name="query" defaultValue={query} allowClear placeholder="搜索商品" aria-label="搜索商品" />
        <Button htmlType="submit" icon={<SearchOutlined />} aria-label="搜索" />
      </form>
    </div>
    <Feedback error={result.error} />
    {result.isPending && <Loading />}
    {products?.length === 0 && <EmptyState title="没有找到商品" description="试试其他关键词，或换一个商品分类。" />}
    <div className="product-grid">{products?.map(product => <Link className="product-card" key={product.id} to={`/shop/${product.id}`}>
      <MediaImage src={product.imageUrl} alt="" className="product-image" />
      <div className="product-copy"><span className="product-category">{categoryNames[product.category]}</span><h2>{product.name}</h2>
        {!!product.variants.length && <p>{formatPrice(Math.min(...product.variants.map(variant => variant.priceCents)))}{product.variants.length > 1 && ' 起'}</p>}
      </div>
    </Link>)}</div>
  </main>;
}

export function ProductDetail() {
  const { productId } = useParams();
  const result = useQuery({ queryKey: ['products', Number(productId)], queryFn: () => api<Product>(`/products/${productId}`) });
  if (result.isPending) return <main className="page-shell"><Loading /></main>;
  if (result.error instanceof ApiError && result.error.status === 404) return <main className="page-shell"><EmptyState title="这件商品暂不可购买"><ButtonLink to="/shop">返回商城</ButtonLink></EmptyState></main>;
  if (result.error) return <main className="page-shell"><Feedback error={result.error} /></main>;
  return <ProductPurchase key={result.data.id} product={result.data} />;
}

function ProductPurchase({ product }: { product: Product }) {
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
    if (!selected || !available || !customReady) return;
    const item: PurchaseItem = { variantId: selected.id, quantity };
    if (product.custom) {
      item.customText = customText.trim();
      item.customPhotoUrl = customPhotoUrl;
    }
    if (mode === 'cart') add.mutate(item);
    else navigate('/checkout', { state: { item, productName: product.name, variantName: selected.name, priceCents: selected.priceCents } });
  }
  return <main className="page-shell">
    <Link className="back-link" to="/shop">返回商城</Link>
    <div className="product-detail">
      <MediaImage src={product.imageUrl} alt={product.name} className="product-detail-photo" />
      <section className="product-detail-copy">
        <Link className="product-category" to={`/shop?category=${product.category}`}>{categoryNames[product.category]}</Link>
        <h1>{product.name}</h1><p className="prose">{product.description}</p>
        {selected && <p className="detail-price">{formatPrice(selected.priceCents)}</p>}
        <Feedback error={add.error || accountError} success={added ? '已加入购物袋' : undefined} />
        {!!product.variants.length && <fieldset className="form-fieldset purchase-fieldset"><legend>规格</legend>
          <Radio.Group value={variantId} onChange={event => { setVariantId(event.target.value); setQuantity(1); setAdded(false); }}>
            {product.variants.map(variant => <Radio.Button key={variant.id} value={variant.id}>{variant.name}</Radio.Button>)}
          </Radio.Group>
        </fieldset>}
        {selected && <div className="purchase-quantity"><label htmlFor="purchase-quantity">数量</label><InputNumber id="purchase-quantity" value={quantity} min={1} max={Math.max(1, Math.min(99, selected.stock))} precision={0} onChange={value => { setQuantity(value || 1); setAdded(false); }} /><span>{selected.stock ? `库存 ${selected.stock} 件` : '当前规格已售罄'}</span></div>}
        {product.custom && <fieldset className="form-fieldset purchase-fieldset"><legend>定制内容</legend>
          <p className="form-hint">填写定制文字或上传一张照片。请在付款前确认。</p>
          <Input aria-label="定制文字" placeholder="例如：小栗子" maxLength={120} value={customText} onChange={event => setCustomText(event.target.value)} />
          {account && <PhotoInput value={customPhotoUrl} onChange={setCustomPhotoUrl} label="上传定制照片" onBusy={setUploading} />}
        </fieldset>}
        {account ? <div className="order-actions purchase-actions">
          <Button type="primary" icon={<ShoppingOutlined />} disabled={!available || !customReady || uploading} loading={add.isPending} onClick={() => select('cart')}>加入购物袋</Button>
          <Button disabled={!available || !customReady || uploading || add.isPending} onClick={() => select('direct')}>立即购买</Button>
          {added && <Link className="text-link" to="/cart">查看购物袋</Link>}
        </div> : <ButtonLink to={loginLink(location.pathname)}>登录后购买</ButtonLink>}
      </section>
    </div>
  </main>;
}
