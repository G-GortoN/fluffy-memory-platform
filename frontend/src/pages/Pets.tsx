import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Form, Input, InputNumber, Popconfirm, Radio, Tag } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { api, ApiError } from '../api';
import { useSession } from '../auth';
import { useLanguage, type Translate } from '../language';
import { localizeSeedText } from '../localized-content';
import type { Care, Pet, Product } from '../types';
import { ButtonLink, EmptyState, Feedback, Loading, MediaImage, PageIntro, PhotoInput } from '../ui';

const petsKey = ['pets'] as const;

function usePets(enabled = true) {
  return useQuery({ queryKey: petsKey, queryFn: () => api<Pet[]>('/pets'), enabled });
}

function ageLabel(age: number, t: Translate) {
  if (age < 12) return t(`${age} 月龄`, `${age} ${age === 1 ? 'month' : 'months'} old`, `${age} 個月大`);
  const years = Math.floor(age / 12);
  const months = age % 12;
  const yearsEn = `${years} ${years === 1 ? 'year' : 'years'}`;
  return months
    ? t(`${years} 岁 ${months} 个月`, `${yearsEn}, ${months} ${months === 1 ? 'month' : 'months'} old`, `${years} 歲 ${months} 個月`)
    : t(`${years} 岁`, `${yearsEn} old`, `${years} 歲`);
}

function petCaption(pet: Pet, t: Translate) {
  const animal = pet.species === 'CAT' ? t('猫咪', 'Cat', '貓咪') : t('狗狗', 'Dog', '狗狗');
  return `${animal} · ${pet.breed || t('未知品种', 'Unknown breed', '品種不詳')} · ${ageLabel(pet.ageMonths, t)}`;
}

export function Pets() {
  const { t } = useLanguage();
  const { data: account, error: accountError, isPending: accountPending } = useSession();
  const pets = usePets(Boolean(account));
  return <main className="page-shell">
    <PageIntro title={account ? t('我的宠物', 'My pets', '我的寵物') : t('宠物照护', 'Pet care', '寵物照顧')} description={t('为毛孩子建档，查看与年龄、品种和生活阶段相关的照护建议。', 'Create a profile and get care advice for your pet’s age, breed and life stage.', '為毛孩建立檔案，查看適合牠年齡、品種和成長階段的照顧建議。')}>
      <ButtonLink to="/pets/new"><PlusOutlined />{t('创建宠物档案', 'Create a pet profile', '建立寵物檔案')}</ButtonLink>
    </PageIntro>
    <Feedback error={accountError || pets.error} />
    {(accountPending || (account && pets.isPending)) && <Loading />}
    {!account && !accountPending && !accountError && <div className="feature-banner">
      <img src="/images/care.webp" alt={t('猫咪的日常照护', 'Everyday care for a cat', '貓咪的日常照顧')} />
      <div><h2>{t('从认识它开始', 'Start with the basics', '由認識牠開始')}</h2><p>{t('记录猫狗的基本资料，查看饮食、饮水和生活环境的照护建议。混种和未知品种也可以建立档案。', 'Add a few details about your cat or dog for advice on feeding, hydration and their home environment. Mixed and unknown breeds are welcome.', '記錄貓狗的基本資料，查看飲食、飲水及居住環境的照顧建議。混種或品種不詳的寵物也可建立檔案。')}</p><ButtonLink to="/pets/new">{t('开始记录', 'Get started', '開始記錄')}</ButtonLink></div>
    </div>}
    {account && pets.data?.length === 0 && <EmptyState title={t('你的宠物档案还空着', 'No pet profiles yet', '尚未建立寵物檔案')} description={t('填写名字、物种和年龄，日常照护就有了一个起点。', 'Start with a name, species and age to get everyday care advice.', '填寫名字、種類和年齡，開始查看日常照顧建議。')}><ButtonLink to="/pets/new">{t('添加第一只宠物', 'Add your first pet', '新增第一隻寵物')}</ButtonLink></EmptyState>}
    {account && !!pets.data?.length && <div className="card-grid">{pets.data.map(pet => <Link className="record-card" key={pet.id} to={`/pets/${pet.id}`}>
      <MediaImage src={pet.photoUrl || '/images/care.webp'} alt="" className="record-image" />
      <div className="record-body"><h2>{pet.name}</h2><p>{petCaption(pet, t)}</p>{pet.status === 'DECEASED' && <Tag>{t('已离世', 'Passed away', '已離世')}</Tag>}</div>
    </Link>)}</div>}
  </main>;
}

export function PetEditor() {
  const { t } = useLanguage();
  const { petId } = useParams();
  const pets = usePets(Boolean(petId));
  if (!petId) return <PetForm />;
  if (pets.isPending) return <main className="page-shell"><Loading /></main>;
  if (pets.error) return <main className="page-shell"><Feedback error={pets.error} /></main>;
  const pet = pets.data.find(item => item.id === Number(petId));
  if (!pet) return <main className="page-shell"><EmptyState title={t('找不到这份档案', 'Pet profile not found', '找不到這份檔案')}><ButtonLink to="/pets">{t('返回我的宠物', 'Back to my pets', '返回我的寵物')}</ButtonLink></EmptyState></main>;
  return <PetForm key={pet.id} pet={pet} />;
}

function PetForm({ pet }: { pet?: Pet }) {
  const { t } = useLanguage();
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
    <Link className="back-link" to={pet ? `/pets/${pet.id}` : '/pets'}>{pet ? t('返回档案', 'Back to profile', '返回檔案') : t('返回我的宠物', 'Back to my pets', '返回我的寵物')}</Link>
    <PageIntro title={pet ? t(`编辑 ${pet.name} 的档案`, `Edit ${pet.name}’s profile`, `編輯 ${pet.name} 的檔案`) : t('创建宠物档案', 'Create a pet profile', '建立寵物檔案')} description={t('按你了解的情况填写，资料可以随时更新。', 'Fill in what you know. You can update these details at any time.', '填寫你知道的資料，日後可隨時更新。')} />
    <section className="form-surface">
      <Feedback error={save.error} />
      <Form layout="vertical" onFinish={values => save.mutate(values)} initialValues={pet || { species: 'CAT', status: 'ACTIVE' }}>
        <div className="form-grid">
          <Form.Item label={t('宠物昵称', 'Pet’s name', '寵物暱稱')} name="name" rules={[{ required: true, whitespace: true, message: t('请输入昵称', 'Enter your pet’s name.', '請輸入寵物暱稱') }, { max: 80 }]}><Input placeholder={t('例如：小栗子', 'e.g. Chestnut', '例如：小栗子')} /></Form.Item>
          <Form.Item label={t('物种', 'Species', '種類')} name="species" rules={[{ required: true }]}><Radio.Group options={[{ value: 'CAT', label: t('猫', 'Cat', '貓') }, { value: 'DOG', label: t('狗', 'Dog', '狗') }]} /></Form.Item>
          <Form.Item label={t('品种', 'Breed', '品種')} name="breed" rules={[{ max: 80 }]}><Input placeholder={t('例如：混种或未知', 'e.g. Mixed or unknown', '例如：混種或不詳')} /></Form.Item>
          <Form.Item label={t('年龄（月）', 'Age in months', '年齡（月）')} name="ageMonths" rules={[{ required: true, message: t('请输入年龄，也可以填写估计值', 'Enter an age. An estimate is fine.', '請填寫年齡，可填寫估計值') }]}><InputNumber min={0} max={600} step={1} precision={0} placeholder={t('可填写估计年龄', 'An estimate is fine', '可填寫估計年齡')} /></Form.Item>
          <Form.Item label={t('体重（公斤）', 'Weight (kg)', '體重（公斤）')} name="weightKg"><InputNumber min={0.01} max={999.99} step={0.1} placeholder={t('选填', 'Optional', '選填')} /></Form.Item>
          {pet && <Form.Item label={t('照护状态', 'Care status', '照顧狀態')} name="status"><Radio.Group options={[{ value: 'ACTIVE', label: t('照护中', 'Receiving care', '照顧中') }, { value: 'DECEASED', label: t('已离世', 'Passed away', '已離世') }]} /></Form.Item>}
        </div>
        <Form.Item label={t('照片', 'Photo', '相片')}><PhotoInput value={photoUrl} onChange={setPhotoUrl} onBusy={setUploading} /></Form.Item>
        <Button type="primary" htmlType="submit" loading={save.isPending} disabled={uploading}>{t('保存档案', 'Save profile', '儲存檔案')}</Button>
      </Form>
    </section>
  </main>;
}

export function PetDetail() {
  const { t, locale } = useLanguage();
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
  if (!pet) return <main className="page-shell"><EmptyState title={t('找不到这份档案', 'Pet profile not found', '找不到這份檔案')}><ButtonLink to="/pets">{t('返回我的宠物', 'Back to my pets', '返回我的寵物')}</ButtonLink></EmptyState></main>;
  return <main className="page-shell">
    <Link className="back-link" to="/pets">{t('返回我的宠物', 'Back to my pets', '返回我的寵物')}</Link>
    <section className="profile-header">
      <MediaImage src={pet.photoUrl || '/images/care.webp'} alt={t(`${pet.name} 的档案配图`, `Profile image for ${pet.name}`, `${pet.name} 的檔案相片`)} className="profile-photo" />
      <PageIntro title={pet.name} description={`${petCaption(pet, t)}${pet.weightKg ? ` · ${t(`${pet.weightKg} 公斤`, `${pet.weightKg} kg`, `${pet.weightKg} 公斤`)}` : ''}`}>
        <ButtonLink to={`/pets/${pet.id}/edit`} secondary>{t('编辑档案', 'Edit profile', '編輯檔案')}</ButtonLink>
        <ButtonLink to={`/memories/new?pet=${pet.id}`} secondary>{t('为它创建纪念页', 'Create a memorial', '為牠建立紀念頁')}</ButtonLink>
      </PageIntro>
    </section>
    <Feedback error={remove.error || advice.error} />
    {pet.status === 'ACTIVE' ? <section className="detail-section">
      <h2>{t('照护建议', 'Care advice', '照顧建議')}</h2>
      {advice.isPending && <Loading />}
      {advice.data?.length === 0 && <EmptyState title={t('暂无适用建议', 'No matching advice yet', '暫未有適合的建議')} description={t('可以更新档案，添加更完整的品种和年龄信息。', 'Try adding more breed or age details to the profile.', '可更新檔案，補充更完整的品種和年齡資料。')} />}
      <div className="card-grid">{advice.data?.map(card => <article className="advice-card" key={card.id}>
        <h3>{localizeSeedText(card.title, locale)}</h3><p className="advice-summary">{localizeSeedText(card.summary, locale)}</p><p className="prose">{localizeSeedText(card.body, locale)}</p>
        <div className="card-links">{card.sourceUrl && <a href={card.sourceUrl} target="_blank" rel="noreferrer">{t('参考资料', 'Reference', '參考資料')}</a>}{card.productId && <CareProduct id={card.productId} />}</div>
      </article>)}</div>
    </section> : <section className="detail-section"><h2>{t('已离世', 'Passed away', '已離世')}</h2><p>{t('留在这份档案里的信息仍然可见。', 'You can still view the details in this profile.', '你仍可查看這份檔案的資料。')}</p><Link className="text-link" to="/memories">{t('查看我的纪念页', 'View my memorials', '查看我的紀念頁')}</Link></section>}
    <div className="danger-area"><Popconfirm title={t('删除这份宠物档案？', 'Delete this pet profile?', '刪除這份寵物檔案？')} okText={t('删除', 'Delete', '刪除')} cancelText={t('返回', 'Cancel', '取消')} onConfirm={() => remove.mutate()}><Button danger type="text" loading={remove.isPending}>{t('删除宠物档案', 'Delete pet profile', '刪除寵物檔案')}</Button></Popconfirm></div>
  </main>;
}

function CareProduct({ id }: { id: number }) {
  const { t } = useLanguage();
  const result = useQuery({ queryKey: ['products', id], queryFn: async () => {
    try { return await api<Product>(`/products/${id}`); }
    catch (error) { if (error instanceof ApiError && error.status === 404) return null; throw error; }
  } });
  return result.data?.active ? <Link to={`/shop/${id}`}>{t('查看相关商品', 'View the related product', '查看相關貨品')}</Link> : null;
}
