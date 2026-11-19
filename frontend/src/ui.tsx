import { useId, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Spin } from 'antd';
import { CheckCircleOutlined, CloseOutlined, PictureOutlined, PlusOutlined } from '@ant-design/icons';
import { uploadPhoto } from './api';
import { useLanguage, type Locale } from './language';
import { localizeError } from './localized-errors';

export function ButtonLink({ to, children, secondary = false, className = '' }: {
  to: string;
  children: ReactNode;
  secondary?: boolean;
  className?: string;
}) {
  return <Link className={`button ${secondary ? 'button-secondary' : 'button-primary'} ${className}`} to={to}>{children}</Link>;
}

export function PawMark() {
  return <span className="paw-mark" aria-hidden="true"><i /><i /><i /><i /></span>;
}

export function Brand() {
  const { t } = useLanguage();
  return <Link to="/" className="brand" aria-label={t('Fluffy Memory 首页', 'Fluffy Memory home', 'Fluffy Memory 主頁')}><PawMark /><span>Fluffy <em>Memory</em></span></Link>;
}

export function PageIntro({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return <header className="page-intro"><div><h1>{title}</h1>{description && <p>{description}</p>}</div>{children && <div className="intro-actions">{children}</div>}</header>;
}

export function Loading() {
  const { t } = useLanguage();
  return <div className="loading" role="status"><Spin size="small" />{t('正在加载', 'Loading', '載入中')}</div>;
}

export function Feedback({ error, success }: { error?: unknown; success?: string }) {
  const { locale } = useLanguage();
  if (error) return <Alert type="error" role="alert" showIcon title={localizeError(error, locale)} />;
  if (success) return <p className="success-message" role="status"><CheckCircleOutlined />{success}</p>;
  return null;
}

export function EmptyState({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return <div className="empty-state"><PawMark /><h2>{title}</h2>{description && <p>{description}</p>}{children}</div>;
}

export function PhotoInput({ value, onChange, label, onBusy }: {
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  label?: string;
  onBusy?: (busy: boolean) => void;
}) {
  const { t } = useLanguage();
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  return <div className="photo-control">
    {value && <div className="photo-preview"><img src={value} alt={t('已上传的照片', 'Uploaded photo', '已上載的相片')} /><button className="icon-button" type="button" aria-label={t('移除照片', 'Remove photo', '移除相片')} onClick={() => onChange(null)}><CloseOutlined /></button></div>}
    <label className="button button-secondary photo-picker" htmlFor={id}><PlusOutlined />{busy ? t('正在上传', 'Uploading', '上載中') : value ? t('更换照片', 'Replace photo', '更換相片') : label ?? t('上传照片', 'Upload photo', '上載相片')}</label>
    <input id={id} type="file" className="visually-hidden photo-input" accept="image/jpeg,image/png" disabled={busy} onChange={async event => {
      const file = event.currentTarget.files?.[0];
      event.currentTarget.value = '';
      if (!file) return;
      setError(undefined);
      setBusy(true);
      onBusy?.(true);
      try {
        onChange((await uploadPhoto(file)).url);
      } catch (uploadError) {
        setError(uploadError);
      } finally {
        setBusy(false);
        onBusy?.(false);
      }
    }} />
    <Feedback error={error} />
  </div>;
}

export function MediaImage({ src, alt, className = '' }: { src?: string | null; alt: string; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (src && src !== failed) return <img className={className} src={src} alt={alt} loading="lazy" onError={() => setFailed(src)} />;
  return <div className={`media-placeholder ${className}`} aria-label={alt || undefined} role={alt ? 'img' : undefined}><PictureOutlined /></div>;
}

const currency = { style: 'currency', currency: 'CNY', maximumFractionDigits: 2 } as const;
const prices = { 'zh-CN': new Intl.NumberFormat('zh-CN', currency), 'zh-HK': new Intl.NumberFormat('zh-HK', currency), en: new Intl.NumberFormat('en', currency) };
export function formatPrice(cents: number, locale: Locale = 'zh-CN') { return prices[locale].format(cents / 100); }
export function formatDate(value: string, locale: Locale = 'zh-CN') { return new Date(value).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' }); }
