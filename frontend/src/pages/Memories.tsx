import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Form, Input, Popconfirm, Radio } from 'antd';
import { CloseOutlined, LockOutlined, PlusOutlined, ShareAltOutlined } from '@ant-design/icons';
import { api } from '../api';
import { useSession } from '../auth';
import type { Memorial, Pet } from '../types';
import { ButtonLink, EmptyState, Feedback, Loading, MediaImage, PageIntro, PhotoInput } from '../ui';

const memoriesKey = ['memorials'] as const;

export function Memories() {
  const session = useSession();
  const result = useQuery({ queryKey: memoriesKey, queryFn: () => api<Memorial[]>('/memorials'), enabled: Boolean(session.data) });
  return <main className="page-shell">
    <PageIntro title="纪念空间" description="用一张照片、一段故事，为想念留一个位置。"><ButtonLink to="/memories/new"><PlusOutlined />创建纪念页</ButtonLink></PageIntro>
    <Feedback error={session.error || result.error} />
    {(session.isPending || (session.data && result.isPending)) && <Loading />}
    {!session.data && !session.isPending && !session.error && <div className="feature-banner memorial-banner">
      <img src="/images/memorial.webp" alt="木质桌面上陈列的宠物照片" />
      <div><h2>一处只属于你们的回忆角</h2><p>记下一段故事，摆上最喜欢的照片。纪念页默认私密，你可以在准备好时邀请亲友查看。</p><ButtonLink to="/memories/new">布置回忆角</ButtonLink></div>
    </div>}
    {session.data && result.data?.length === 0 && <EmptyState title="还没有纪念页" description="想记录时，从一张照片或一句想说的话开始。"><ButtonLink to="/memories/new">创建第一份回忆</ButtonLink></EmptyState>}
    {session.data && !!result.data?.length && <div className="card-grid">{result.data.map(memory => <Link className="record-card" key={memory.id} to={`/memories/${memory.id}`}>
      <MediaImage src={memory.photoUrl || '/images/memorial.webp'} alt="" className="record-image" />
      <div className="record-body"><h2>{memory.title}</h2><p>{memory.petName} · {memory.shareEnabled ? '已开启分享' : '仅自己可见'}</p></div>
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
    <Link className="back-link" to={memory ? `/memories/${memory.id}` : '/memories'}>返回纪念空间</Link>
    <PageIntro title={memory ? '编辑纪念页' : '布置一处回忆'} description={memory?.shareEnabled ? "持有分享链接的亲友也能看到保存后的内容。" : "填写你想留下的内容。保存后，仅你自己可以看到。"} />
    <Feedback error={save.error} />
    <section className="form-surface">
      {pet?.status === 'ACTIVE' && <p className="inline-note">为 {pet.name} 创建纪念页时，这份宠物档案会标记为已离世，日常照护建议将会停止。</p>}
      <Form layout="vertical" onFinish={values => save.mutate(values)} initialValues={memory || { petName: pet?.name, title: pet ? `想念${pet.name}` : '', template: 'CORNER', timeline: [] }}>
        <div className="form-grid">
          <Form.Item name="petName" label="宠物昵称" rules={[{ required: true, whitespace: true, message: '请输入宠物昵称' }, { max: 80 }]}><Input readOnly={Boolean(pet)} /></Form.Item>
          <Form.Item name="title" label="纪念页标题" rules={[{ required: true, whitespace: true, message: '请输入标题' }, { max: 150 }]}><Input placeholder="例如：想念小栗子" /></Form.Item>
        </div>
        <Form.Item name="template" label="页面样式" rules={[{ required: true }]}><Radio.Group options={[{ value: 'CORNER', label: '温暖回忆角' }, { value: 'HALL', label: '安静纪念堂' }]} /></Form.Item>
        <Form.Item name="story" label="故事或寄语"><Input.TextArea rows={6} maxLength={12000} placeholder="在这里写下一个片段，或一句想对它说的话。" /></Form.Item>
        <Form.Item label="封面照片"><PhotoInput value={photoUrl} onChange={setPhotoUrl} onBusy={updatePendingUploads} /></Form.Item>
        <fieldset className="form-fieldset"><legend>珍藏照片</legend>
          {!!gallery.length && <div className="gallery-editor">{gallery.map((url, index) => <div className="photo-preview" key={`${url}-${index}`}><MediaImage src={url} alt={`纪念照片 ${index + 1}`} /><button type="button" className="icon-button" aria-label={`移除照片 ${index + 1}`} onClick={() => setGallery(items => items.filter((_, position) => position !== index))}><CloseOutlined /></button></div>)}</div>}
          {gallery.length < 20 && <PhotoInput value={null} label="添加照片" onBusy={updatePendingUploads} onChange={url => { if (url) setGallery(items => [...items, url]); }} />}
        </fieldset>
        <fieldset className="form-fieldset"><legend>回忆时间线</legend>
          <Form.List name="timeline">{(fields, { add, remove }) => <>
            {fields.map(field => <div className="timeline-input" key={field.key}>
              <Form.Item name={[field.name, 'date']} rules={[{ required: true, message: '填写日期' }]}><Input type="date" aria-label="回忆日期" /></Form.Item>
              <Form.Item name={[field.name, 'text']} rules={[{ required: true, whitespace: true, message: '填写回忆' }]}><Input maxLength={600} aria-label="回忆内容" placeholder="那天发生了什么" /></Form.Item>
              <Button type="text" aria-label="移除这段回忆" icon={<CloseOutlined />} onClick={() => remove(field.name)} />
            </div>)}
            {fields.length < 20 && <Button htmlType="button" icon={<PlusOutlined />} onClick={() => add()}>添加片段</Button>}
          </>}</Form.List>
        </fieldset>
        <Button type="primary" htmlType="submit" loading={save.isPending} disabled={pendingUploads > 0}>保存纪念页</Button>
      </Form>
    </section>
  </main>;
}

export function MemorialDetail({ shared = false }: { shared?: boolean }) {
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
  if (result.error) return <main className="page-shell"><EmptyState title={shared ? '这个分享链接已失效或无法打开' : '无法打开纪念页'}><ButtonLink to="/memories">返回纪念空间</ButtonLink></EmptyState></main>;
  const memory = result.data;
  const shareUrl = newToken && `${window.location.origin}/memories/shared/${newToken}`;
  return <main className="page-shell memorial-page">
    {!shared && <div className="memorial-toolbar"><Link className="back-link" to="/memories">返回纪念空间</Link><div className="order-actions"><ButtonLink to={`/memories/${memory.id}/edit`} secondary>编辑纪念页</ButtonLink></div></div>}
    <article className={`memorial-sheet ${memory.template === 'HALL' ? 'quiet-sheet' : ''}`}>
      <MediaImage alt={memory.photoUrl ? `${memory.petName} 的照片` : ''} src={memory.photoUrl || '/images/memorial.webp'} className="memorial-cover" />
      <div className="memorial-story"><p className="memory-name">{memory.petName}</p><h1>{memory.title}</h1>{memory.story && <p className="prose">{memory.story}</p>}</div>
      {!!memory.gallery?.length && <section className="memorial-extra"><h2>珍藏照片</h2><div className="gallery-grid">{memory.gallery.map((url, index) => <MediaImage key={`${url}-${index}`} src={url} alt={`纪念照片 ${index + 1}`} />)}</div></section>}
      {!!memory.timeline?.length && <section className="memorial-extra"><h2>回忆时间线</h2><ol className="memory-timeline">{memory.timeline.map((entry, index) => <li key={`${entry.date}-${index}`}><time dateTime={entry.date}>{entry.date}</time><p>{entry.text}</p></li>)}</ol></section>}
    </article>
    {!shared && <section className="share-box form-surface" aria-labelledby="share-title">
      <div><h2 id="share-title"><LockOutlined /> 分享设置</h2><p>{memory.shareEnabled ? '持有当前链接的亲友可以访问。' : '这份记忆目前仅自己可见。'}</p></div>
      <Feedback error={share.error || remove.error} success={copied ? '已复制分享链接' : undefined} />
      {shareUrl && <div className="share-row"><Input aria-label="分享链接" value={shareUrl} readOnly onFocus={event => event.target.select()} /><Button disabled={!navigator.clipboard} onClick={() => navigator.clipboard.writeText(shareUrl).then(() => setCopied(true)).catch(() => setCopied(false))}>复制链接</Button></div>}
      <div className="order-actions">
        {!memory.shareEnabled && <Button type="primary" icon={<ShareAltOutlined />} loading={share.isPending} onClick={() => share.mutate(true)}>生成分享链接</Button>}
        {memory.shareEnabled && <><Popconfirm title="生成新链接后，旧链接会失效" onConfirm={() => share.mutate(true)} okText="重新生成" cancelText="返回"><Button loading={share.isPending}>重新生成链接</Button></Popconfirm><Button onClick={() => share.mutate(false)} disabled={share.isPending}>撤销分享</Button></>}
        <ButtonLink to="/shop?collection=memory" secondary>查看纪念用品</ButtonLink>
      </div>
      <Popconfirm title="删除这份纪念页？" onConfirm={() => remove.mutate()} okText="删除" cancelText="返回"><Button danger type="text" loading={remove.isPending}>删除纪念页</Button></Popconfirm>
    </section>}
  </main>;
}
