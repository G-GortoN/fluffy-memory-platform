import { useId, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Spin } from 'antd';
import { CheckCircleOutlined, CloseOutlined, PictureOutlined, PlusOutlined } from '@ant-design/icons';
import { uploadPhoto } from './api';

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
  return <Link to="/" className="brand" aria-label="Fluffy Memory 首页"><PawMark /><span>Fluffy <em>Memory</em></span></Link>;
}

export function PageIntro({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return <header className="page-intro"><div><h1>{title}</h1>{description && <p>{description}</p>}</div>{children && <div className="intro-actions">{children}</div>}</header>;
}

export function Loading() {
  return <div className="loading" role="status"><Spin size="small" />正在加载</div>;
}

export function Feedback({ error, success }: { error?: unknown; success?: string }) {
  if (error) return <Alert type="error" role="alert" showIcon title={error instanceof Error ? error.message : '暂时无法完成操作。'} />;
  if (success) return <p className="success-message" role="status"><CheckCircleOutlined />{success}</p>;
  return null;
}

export function EmptyState({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return <div className="empty-state"><PawMark /><h2>{title}</h2>{description && <p>{description}</p>}{children}</div>;
}

export function PhotoInput({ value, onChange, label = '上传照片', onBusy }: {
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  label?: string;
  onBusy?: (busy: boolean) => void;
}) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  return <div className="photo-control">
    {value && <div className="photo-preview"><img src={value} alt="已上传的照片" /><button className="icon-button" type="button" aria-label="移除照片" onClick={() => onChange(null)}><CloseOutlined /></button></div>}
    <label className="button button-secondary photo-picker" htmlFor={id}><PlusOutlined />{busy ? '正在上传' : value ? '更换照片' : label}</label>
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

export const money = new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 2 });
export function formatPrice(cents: number) { return money.format(cents / 100); }
export function formatDate(value: string) { return new Date(value).toLocaleString('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }); }
