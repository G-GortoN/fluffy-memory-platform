import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Form, Input, InputNumber, Popconfirm, Radio, Tag } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { api, ApiError } from '../api';
import { useSession } from '../auth';
import type { Care, Pet, Product } from '../types';
import { ButtonLink, EmptyState, Feedback, Loading, MediaImage, PageIntro, PhotoInput } from '../ui';

const petsKey = ['pets'] as const;
const animal = { CAT: '猫咪', DOG: '狗狗' };

function usePets(enabled = true) {
  return useQuery({ queryKey: petsKey, queryFn: () => api<Pet[]>('/pets'), enabled });
}

function ageLabel(age: number) {
  if (age < 12) return `${age} 月龄`;
  const years = Math.floor(age / 12);
  const months = age % 12;
  return months ? `${years} 岁 ${months} 个月` : `${years} 岁`;
}

export function Pets() {
  const { data: account, error: accountError, isPending: accountPending } = useSession();
  const pets = usePets(Boolean(account));
  return <main className="page-shell">
    <PageIntro title={account ? '我的宠物' : '宠物照护'} description="为毛孩子建档，查看与年龄、品种和生活阶段相关的照护建议。">
      <ButtonLink to="/pets/new"><PlusOutlined />创建宠物档案</ButtonLink>
    </PageIntro>
    <Feedback error={accountError || pets.error} />
    {(accountPending || (account && pets.isPending)) && <Loading />}
    {!account && !accountPending && !accountError && <div className="feature-banner">
      <img src="/images/care.webp" alt="猫咪的日常照护" />
      <div><h2>从认识它开始</h2><p>记录猫狗的基本资料，查看饮食、饮水和生活环境的照护建议。混种和未知品种也可以建立档案。</p><ButtonLink to="/pets/new">开始记录</ButtonLink></div>
    </div>}
    {account && pets.data?.length === 0 && <EmptyState title="你的宠物档案还空着" description="填写名字、物种和年龄，日常照护就有了一个起点。"><ButtonLink to="/pets/new">添加第一只宠物</ButtonLink></EmptyState>}
    {account && !!pets.data?.length && <div className="card-grid">{pets.data.map(pet => <Link className="record-card" key={pet.id} to={`/pets/${pet.id}`}>
      <MediaImage src={pet.photoUrl || '/images/care.webp'} alt="" className="record-image" />
      <div className="record-body"><h2>{pet.name}</h2><p>{animal[pet.species]} · {pet.breed || '未知品种'} · {ageLabel(pet.ageMonths)}</p>{pet.status === 'DECEASED' && <Tag>已离世</Tag>}</div>
    </Link>)}</div>}
  </main>;
}

export function PetEditor() {
  const { petId } = useParams();
  const pets = usePets(Boolean(petId));
  if (!petId) return <PetForm />;
  if (pets.isPending) return <main className="page-shell"><Loading /></main>;
  if (pets.error) return <main className="page-shell"><Feedback error={pets.error} /></main>;
  const pet = pets.data.find(item => item.id === Number(petId));
  if (!pet) return <main className="page-shell"><EmptyState title="找不到这份档案"><ButtonLink to="/pets">返回我的宠物</ButtonLink></EmptyState></main>;
  return <PetForm key={pet.id} pet={pet} />;
}

function PetForm({ pet }: { pet?: Pet }) {
  const client = useQueryClient();
  const navigate = useNavigate();
  const [photoUrl, setPhotoUrl] = useState(pet?.photoUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const save = useMutation({
    mutationFn: (values: Omit<Pet, 'id' | 'photoUrl'>) => api<Pet>(pet ? `/pets/${pet.id}` : '/pets', pet ? 'PUT' : 'POST', { ...values, photoUrl }),
    onSuccess: async saved => {
      await client.invalidateQueries({ queryKey: petsKey });
      await client.invalidateQueries({ queryKey: ['care', saved.id] });
      navigate(`/pets/${saved.id}`);
    },
  });
  return <main className="page-shell narrow-page">
    <Link className="back-link" to={pet ? `/pets/${pet.id}` : '/pets'}>返回{pet ? '档案' : '我的宠物'}</Link>
    <PageIntro title={pet ? `编辑 ${pet.name} 的档案` : '创建宠物档案'} description="按你了解的情况填写，资料可以随时更新。" />
    <section className="form-surface">
      <Feedback error={save.error} />
      <Form layout="vertical" onFinish={values => save.mutate(values)} initialValues={pet || { species: 'CAT', status: 'ACTIVE' }}>
        <div className="form-grid">
          <Form.Item label="宠物昵称" name="name" rules={[{ required: true, whitespace: true, message: '请输入昵称' }, { max: 80 }]}><Input placeholder="例如：小栗子" /></Form.Item>
          <Form.Item label="物种" name="species" rules={[{ required: true }]}><Radio.Group options={[{ value: 'CAT', label: '猫' }, { value: 'DOG', label: '狗' }]} /></Form.Item>
          <Form.Item label="品种" name="breed" rules={[{ max: 80 }]}><Input placeholder="例如：混种或未知" /></Form.Item>
          <Form.Item label="年龄（月）" name="ageMonths" rules={[{ required: true, message: '请输入年龄，也可以填写估计值' }]}><InputNumber min={0} max={600} step={1} precision={0} placeholder="可填写估计年龄" /></Form.Item>
          <Form.Item label="体重（公斤）" name="weightKg"><InputNumber min={0.01} max={999.99} step={0.1} placeholder="选填" /></Form.Item>
          {pet && <Form.Item label="照护状态" name="status"><Radio.Group options={[{ value: 'ACTIVE', label: '照护中' }, { value: 'DECEASED', label: '已离世' }]} /></Form.Item>}
        </div>
        <Form.Item label="照片"><PhotoInput value={photoUrl} onChange={setPhotoUrl} onBusy={setUploading} /></Form.Item>
        <Button type="primary" htmlType="submit" loading={save.isPending} disabled={uploading}>保存档案</Button>
      </Form>
    </section>
  </main>;
}

export function PetDetail() {
  const { petId } = useParams();
  const pets = usePets();
  const pet = pets.data?.find(item => item.id === Number(petId));
  const advice = useQuery({ queryKey: ['care', pet?.id], queryFn: () => api<Care[]>(`/pets/${pet?.id}/care`), enabled: pet?.status === 'ACTIVE' });
  const client = useQueryClient();
  const navigate = useNavigate();
  const remove = useMutation({
    mutationFn: () => api<void>(`/pets/${petId}`, 'DELETE'),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: petsKey });
      await client.invalidateQueries({ queryKey: ['memorials'] });
      navigate('/pets');
    },
  });
  if (pets.isPending) return <main className="page-shell"><Loading /></main>;
  if (pets.error) return <main className="page-shell"><Feedback error={pets.error} /></main>;
  if (!pet) return <main className="page-shell"><EmptyState title="找不到这份档案"><ButtonLink to="/pets">返回我的宠物</ButtonLink></EmptyState></main>;
  return <main className="page-shell">
    <Link className="back-link" to="/pets">返回我的宠物</Link>
    <section className="profile-header">
      <MediaImage src={pet.photoUrl || '/images/care.webp'} alt={`${pet.name} 的档案配图`} className="profile-photo" />
      <PageIntro title={pet.name} description={`${animal[pet.species]} · ${pet.breed || '未知品种'} · ${ageLabel(pet.ageMonths)}${pet.weightKg ? ` · ${pet.weightKg} 公斤` : ''}`}>
        <ButtonLink to={`/pets/${pet.id}/edit`} secondary>编辑档案</ButtonLink>
        <ButtonLink to={`/memories/new?pet=${pet.id}`} secondary>为它创建纪念页</ButtonLink>
      </PageIntro>
    </section>
    <Feedback error={remove.error || advice.error} />
    {pet.status === 'ACTIVE' ? <section className="detail-section">
      <h2>照护建议</h2>
      {advice.isPending && <Loading />}
      {advice.data?.length === 0 && <EmptyState title="暂无适用建议" description="可以更新档案，添加更完整的品种和年龄信息。" />}
      <div className="card-grid">{advice.data?.map(card => <article className="advice-card" key={card.id}>
        <h3>{card.title}</h3><p className="advice-summary">{card.summary}</p><p className="prose">{card.body}</p>
        <div className="card-links">{card.sourceUrl && <a href={card.sourceUrl} target="_blank" rel="noreferrer">参考资料</a>}{card.productId && <CareProduct id={card.productId} />}</div>
      </article>)}</div>
    </section> : <section className="detail-section"><h2>已离世</h2><p>留在这份档案里的信息仍然可见。</p><Link className="text-link" to="/memories">查看我的纪念页</Link></section>}
    <div className="danger-area"><Popconfirm title="删除这份宠物档案？" okText="删除" cancelText="返回" onConfirm={() => remove.mutate()}><Button danger type="text" loading={remove.isPending}>删除宠物档案</Button></Popconfirm></div>
  </main>;
}

function CareProduct({ id }: { id: number }) {
  const result = useQuery({ queryKey: ['products', id], queryFn: async () => {
    try { return await api<Product>(`/products/${id}`); }
    catch (error) { if (error instanceof ApiError && error.status === 404) return null; throw error; }
  } });
  return result.data?.active ? <Link to={`/shop/${id}`}>查看相关商品</Link> : null;
}
