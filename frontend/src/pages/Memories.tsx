import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Form, Input, Popconfirm, Radio } from 'antd';
import { CloseOutlined, LockOutlined, PlusOutlined, ShareAltOutlined } from '@ant-design/icons';
import { api } from '../api';
import { useSession } from '../auth';
import { useLanguage } from '../language';
import type { Memorial, Pet } from '../types';
import { ButtonLink, EmptyState, Feedback, Loading, MediaImage, PageIntro, PhotoInput } from '../ui';

const memoriesKey = ['memorials'] as const;

export function Memories() {
  const { t } = useLanguage();
  const session = useSession();
  const result = useQuery({ queryKey: memoriesKey, queryFn: () => api<Memorial[]>('/memorials'), enabled: Boolean(session.data) });
  return <main className="page-shell">
    <PageIntro title={t('纪念空间', 'Memorials', '紀念空間')} description={t('用一张照片、一段故事，为想念留一个位置。', 'Make a space for the photos and stories you want to keep.', '用一張相片、一段故事，為思念留一個位置。')}><ButtonLink to="/memories/new"><PlusOutlined />{t('创建纪念页', 'Create a memorial', '建立紀念頁')}</ButtonLink></PageIntro>
    <Feedback error={session.error || result.error} />
    {(session.isPending || (session.data && result.isPending)) && <Loading />}
    {!session.data && !session.isPending && !session.error && <div className="feature-banner memorial-banner">
      <img src="/images/memorial.webp" alt={t('木质桌面上陈列的宠物照片', 'A pet photo displayed on a wooden table', '木枱上擺放的寵物相片')} />
      <div><h2>{t('一处只属于你们的回忆角', 'A place for your memories', '一個只屬於你們的回憶角')}</h2><p>{t('记下一段故事，摆上最喜欢的照片。纪念页默认私密，你可以在准备好时邀请亲友查看。', 'Write down a story and add a favourite photo. Your memorial is private until you choose to share it.', '記下一段故事，放上最喜愛的相片。紀念頁預設只有自己可見，你可以準備好後再與親友分享。')}</p><ButtonLink to="/memories/new">{t('布置回忆角', 'Create a memorial', '佈置回憶角')}</ButtonLink></div>
    </div>}
    {session.data && result.data?.length === 0 && <EmptyState title={t('还没有纪念页', 'No memorials yet', '尚未建立紀念頁')} description={t('想记录时，从一张照片或一句想说的话开始。', 'When you’re ready, start with a photo or a few words.', '想記錄時，可以由一張相片或一句想說的話開始。')}><ButtonLink to="/memories/new">{t('创建第一份回忆', 'Create your first memorial', '建立第一個紀念頁')}</ButtonLink></EmptyState>}
    {session.data && !!result.data?.length && <div className="card-grid">{result.data.map(memory => <Link className="record-card" key={memory.id} to={`/memories/${memory.id}`}>
      <MediaImage src={memory.photoUrl || '/images/memorial.webp'} alt="" className="record-image" />
      <div className="record-body"><h2>{memory.title}</h2><p>{memory.petName} · {memory.shareEnabled ? t('已开启分享', 'Link sharing on', '已開啟分享') : t('仅自己可见', 'Private', '只有自己可見')}</p></div>
    </Link>)}</div>}
  </main>;
}

type MemorialInput = Pick<Memorial, 'petName' | 'title' | 'story' | 'template' | 'timeline'>;

export function MemorialEditor() {
  const { memoryId } = useParams();
  const [params] = useSearchParams();
  const petId = Number(params.get('pet'));
  const existing = useQuery({ queryKey: [...memoriesKey, memoryId], queryFn: () => api<Memorial>(`/memorials/${memoryId}`), enabled: Boolean(memoryId) });
  const pet = useQuery({ queryKey: ['pets', petId], queryFn: () => api<Pet>(`/pets/${petId}`), enabled: !memoryId && Number.isSafeInteger(petId) && petId > 0 });
  if ((memoryId && existing.isPending) || (petId > 0 && pet.isLoading)) return <main className="page-shell"><Loading /></main>;
  if (existing.error || pet.error) return <main className="page-shell"><Feedback error={existing.error || pet.error} /></main>;
  return <MemorialForm key={memoryId || `new-${petId}`} memory={existing.data} pet={pet.data} />;
}

function MemorialForm({ memory, pet }: { memory?: Memorial; pet?: Pet }) {
  const { t } = useLanguage();
  const client = useQueryClient();
  const navigate = useNavigate();
  const [photoUrl, setPhotoUrl] = useState(memory?.photoUrl ?? pet?.photoUrl ?? null);
  const [gallery, setGallery] = useState(memory?.gallery ?? []);
  const [pendingUploads, setPendingUploads] = useState(0);
  const updatePendingUploads = (busy: boolean) => setPendingUploads(count => count + (busy ? 1 : -1));
  const save = useMutation({
    mutationFn: (values: MemorialInput) => api<Memorial>(memory ? `/memorials/${memory.id}` : '/memorials', memory ? 'PUT' : 'POST', {
      ...values,
      story: values.story ?? '',
      timeline: values.timeline ?? [],
      petId: memory?.petId ?? pet?.id,
      photoUrl,
      gallery,
    }),
    onSuccess: async saved => {
      await client.invalidateQueries({ queryKey: memoriesKey });
      await client.invalidateQueries({ queryKey: ['pets'] });
      await client.invalidateQueries({ queryKey: ['care'] });
      navigate(`/memories/${saved.id}`);
    },
  });
  return <main className="page-shell narrow-page">
    <Link className="back-link" to={memory ? `/memories/${memory.id}` : '/memories'}>{t('返回纪念空间', 'Back to memorials', '返回紀念空間')}</Link>
    <PageIntro title={memory ? t('编辑纪念页', 'Edit memorial', '編輯紀念頁') : t('布置一处回忆', 'Create a memorial', '佈置回憶角')} description={memory?.shareEnabled ? t('持有分享链接的亲友也能看到保存后的内容。', 'Anyone with the sharing link can see the changes you save.', '持有分享連結的親友也可看到你儲存的內容。') : t('填写你想留下的内容。保存后，仅你自己可以看到。', 'Add what you’d like to remember. Your saved memorial is private.', '填寫你想留下的內容。儲存後，只有你可看到。')} />
    <Feedback error={save.error} />
    <section className="form-surface">
      {pet?.status === 'ACTIVE' && <p className="inline-note">{t(`为 ${pet.name} 创建纪念页时，这份宠物档案会标记为已离世，日常照护建议将会停止。`, `Creating a memorial for ${pet.name} will mark their profile as passed away and stop daily care advice.`, `為 ${pet.name} 建立紀念頁後，這份寵物檔案會標示為已離世，並停止顯示日常照顧建議。`)}</p>}
      <Form layout="vertical" onFinish={values => save.mutate(values)} initialValues={memory || { petName: pet?.name, title: pet ? t(`想念${pet.name}`, `Remembering ${pet.name}`, `想念${pet.name}`) : '', template: 'CORNER', timeline: [] }}>
        <div className="form-grid">
          <Form.Item name="petName" label={t('宠物昵称', 'Pet’s name', '寵物暱稱')} rules={[{ required: true, whitespace: true, message: t('请输入宠物昵称', 'Enter your pet’s name.', '請輸入寵物暱稱') }, { max: 80 }]}><Input readOnly={Boolean(pet)} /></Form.Item>
          <Form.Item name="title" label={t('纪念页标题', 'Memorial title', '紀念頁標題')} rules={[{ required: true, whitespace: true, message: t('请输入标题', 'Enter a title.', '請輸入標題') }, { max: 150 }]}><Input placeholder={t('例如：想念小栗子', 'e.g. Remembering Chestnut', '例如：想念小栗子')} /></Form.Item>
        </div>
        <Form.Item name="template" label={t('页面样式', 'Page style', '頁面樣式')} rules={[{ required: true }]}><Radio.Group options={[{ value: 'CORNER', label: t('温暖回忆角', 'Memory corner', '溫暖回憶角') }, { value: 'HALL', label: t('安静纪念堂', 'Quiet memorial', '寧靜紀念堂') }]} /></Form.Item>
        <Form.Item name="story" label={t('故事或寄语', 'Story or tribute', '故事或寄語')}><Input.TextArea rows={6} maxLength={12000} placeholder={t('在这里写下一个片段，或一句想对它说的话。', 'Write down a memory or a few words for them.', '在這裏寫下一個片段，或一句想對牠說的話。')} /></Form.Item>
        <Form.Item label={t('封面照片', 'Cover photo', '封面相片')}><PhotoInput value={photoUrl} onChange={setPhotoUrl} onBusy={updatePendingUploads} /></Form.Item>
        <fieldset className="form-fieldset"><legend>{t('珍藏照片', 'Photo gallery', '珍藏相片')}</legend>
          {!!gallery.length && <div className="gallery-editor">{gallery.map((url, index) => <div className="photo-preview" key={`${url}-${index}`}><MediaImage src={url} alt={t(`纪念照片 ${index + 1}`, `Memorial photo ${index + 1}`, `紀念相片 ${index + 1}`)} /><button type="button" className="icon-button" aria-label={t(`移除照片 ${index + 1}`, `Remove photo ${index + 1}`, `移除相片 ${index + 1}`)} onClick={() => setGallery(items => items.filter((_, position) => position !== index))}><CloseOutlined /></button></div>)}</div>}
          {gallery.length < 20 && <PhotoInput value={null} label={t('添加照片', 'Add a photo', '新增相片')} onBusy={updatePendingUploads} onChange={url => { if (url) setGallery(items => [...items, url]); }} />}
        </fieldset>
        <fieldset className="form-fieldset"><legend>{t('回忆时间线', 'Memory timeline', '回憶時間線')}</legend>
          <Form.List name="timeline">{(fields, { add, remove }) => <>
            {fields.map(field => <div className="timeline-input" key={field.key}>
              <Form.Item name={[field.name, 'date']} rules={[{ required: true, message: t('填写日期', 'Enter a date.', '請填寫日期') }]}><Input type="date" aria-label={t('回忆日期', 'Date of memory', '回憶日期')} /></Form.Item>
              <Form.Item name={[field.name, 'text']} rules={[{ required: true, whitespace: true, message: t('填写回忆', 'Add a memory.', '請填寫回憶') }]}><Input maxLength={600} aria-label={t('回忆内容', 'Memory', '回憶內容')} placeholder={t('那天发生了什么', 'What happened that day?', '那天發生了甚麼事？')} /></Form.Item>
              <Button type="text" aria-label={t('移除这段回忆', 'Remove this memory', '移除這段回憶')} icon={<CloseOutlined />} onClick={() => remove(field.name)} />
            </div>)}
            {fields.length < 20 && <Button htmlType="button" icon={<PlusOutlined />} onClick={() => add()}>{t('添加片段', 'Add a memory', '新增回憶片段')}</Button>}
          </>}</Form.List>
        </fieldset>
        <Button type="primary" htmlType="submit" loading={save.isPending} disabled={pendingUploads > 0}>{t('保存纪念页', 'Save memorial', '儲存紀念頁')}</Button>
      </Form>
    </section>
  </main>;
}

export function MemorialDetail({ shared = false }: { shared?: boolean }) {
  const { t, locale } = useLanguage();
  const { memoryId, token } = useParams();
  const client = useQueryClient();
  const navigate = useNavigate();
  const [newToken, setNewToken] = useState<string>();
  const [copied, setCopied] = useState(false);
  const result = useQuery({
    queryKey: shared ? ['shared-memorial', token] : [...memoriesKey, memoryId],
    queryFn: () => api<Memorial>(shared ? `/shared/${encodeURIComponent(token || '')}` : `/memorials/${memoryId}`),
    staleTime: 0,
    gcTime: shared ? 0 : 60_000,
  });
  const share = useMutation({
    mutationFn: async (enable: boolean) => {
      if (enable) return (await api<{ token: string }>(`/memorials/${memoryId}/share`, 'POST')).token;
      await api<void>(`/memorials/${memoryId}/share`, 'DELETE');
    },
    onSuccess: async value => {
      setNewToken(value);
      setCopied(false);
      await client.invalidateQueries({ queryKey: memoriesKey });
    },
  });
  const remove = useMutation({
    mutationFn: () => api<void>(`/memorials/${memoryId}`, 'DELETE'),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: memoriesKey });
      navigate('/memories');
    },
  });
  if (result.isPending) return <main className="page-shell"><Loading /></main>;
  if (result.error) return <main className="page-shell"><EmptyState title={shared ? t('这个分享链接已失效或无法打开', 'This sharing link has expired or is unavailable', '這條分享連結已失效或無法開啟') : t('无法打开纪念页', 'This memorial is unavailable', '無法開啟紀念頁')}><ButtonLink to="/memories">{t('返回纪念空间', 'Back to memorials', '返回紀念空間')}</ButtonLink></EmptyState></main>;
  const memory = result.data;
  const shareUrl = newToken && `${window.location.origin}/memories/shared/${newToken}`;
  const timelineDate = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' });
  return <main className="page-shell memorial-page">
    {!shared && <div className="memorial-toolbar"><Link className="back-link" to="/memories">{t('返回纪念空间', 'Back to memorials', '返回紀念空間')}</Link><div className="order-actions"><ButtonLink to={`/memories/${memory.id}/edit`} secondary>{t('编辑纪念页', 'Edit memorial', '編輯紀念頁')}</ButtonLink></div></div>}
    <article className={`memorial-sheet ${memory.template === 'HALL' ? 'quiet-sheet' : ''}`}>
      <MediaImage alt={memory.photoUrl ? t(`${memory.petName} 的照片`, `Photo of ${memory.petName}`, `${memory.petName} 的相片`) : ''} src={memory.photoUrl || '/images/memorial.webp'} className="memorial-cover" />
      <div className="memorial-story"><p className="memory-name">{memory.petName}</p><h1>{memory.title}</h1>{memory.story && <p className="prose">{memory.story}</p>}</div>
      {!!memory.gallery?.length && <section className="memorial-extra"><h2>{t('珍藏照片', 'Photo gallery', '珍藏相片')}</h2><div className="gallery-grid">{memory.gallery.map((url, index) => <MediaImage key={`${url}-${index}`} src={url} alt={t(`纪念照片 ${index + 1}`, `Memorial photo ${index + 1}`, `紀念相片 ${index + 1}`)} />)}</div></section>}
      {!!memory.timeline?.length && <section className="memorial-extra"><h2>{t('回忆时间线', 'Memory timeline', '回憶時間線')}</h2><ol className="memory-timeline">{memory.timeline.map((entry, index) => <li key={`${entry.date}-${index}`}><time dateTime={entry.date}>{timelineDate.format(new Date(entry.date))}</time><p>{entry.text}</p></li>)}</ol></section>}
    </article>
    {!shared && <section className="share-box form-surface" aria-labelledby="share-title">
      <div><h2 id="share-title"><LockOutlined /> {t('分享设置', 'Sharing settings', '分享設定')}</h2><p>{memory.shareEnabled ? t('持有当前链接的亲友可以访问。', 'Anyone with the current link can view this memorial.', '持有目前連結的親友可以查看。') : t('这份记忆目前仅自己可见。', 'Only you can view this memorial.', '這份回憶目前只有你可查看。')}</p></div>
      <Feedback error={share.error || remove.error} success={copied ? t('已复制分享链接', 'Sharing link copied', '已複製分享連結') : undefined} />
      {shareUrl && <div className="share-row"><Input aria-label={t('分享链接', 'Sharing link', '分享連結')} value={shareUrl} readOnly onFocus={event => event.target.select()} /><Button disabled={!navigator.clipboard} onClick={() => navigator.clipboard.writeText(shareUrl).then(() => setCopied(true)).catch(() => setCopied(false))}>{t('复制链接', 'Copy link', '複製連結')}</Button></div>}
      <div className="order-actions">
        {!memory.shareEnabled && <Button type="primary" icon={<ShareAltOutlined />} loading={share.isPending} onClick={() => share.mutate(true)}>{t('生成分享链接', 'Create a sharing link', '建立分享連結')}</Button>}
        {memory.shareEnabled && <><Popconfirm title={t('生成新链接后，旧链接会失效', 'Creating a new link disables the current one', '建立新連結後，舊連結會失效')} onConfirm={() => share.mutate(true)} okText={t('重新生成', 'Create new link', '重新建立')} cancelText={t('返回', 'Cancel', '取消')}><Button loading={share.isPending}>{t('重新生成链接', 'Replace sharing link', '重新建立分享連結')}</Button></Popconfirm><Button onClick={() => share.mutate(false)} disabled={share.isPending}>{t('撤销分享', 'Turn off sharing', '停止分享')}</Button></>}
        <ButtonLink to="/shop?collection=memory" secondary>{t('查看纪念用品', 'Browse keepsakes', '瀏覽紀念用品')}</ButtonLink>
      </div>
      <Popconfirm title={t('删除这份纪念页？', 'Delete this memorial?', '刪除這個紀念頁？')} onConfirm={() => remove.mutate()} okText={t('删除', 'Delete', '刪除')} cancelText={t('返回', 'Cancel', '取消')}><Button danger type="text" loading={remove.isPending}>{t('删除纪念页', 'Delete memorial', '刪除紀念頁')}</Button></Popconfirm>
    </section>}
  </main>;
}
