// Small reusable UI pieces: buttons, cards, modal, badges, photos, toasts.

import { useEffect, useRef, useState, type ReactNode, type ButtonHTMLAttributes } from 'react';
import { LuX, LuCamera, LuTrash2, LuPencil } from 'react-icons/lu';
import { t, type Site } from '@kebun/shared';
import { useStore, errorText } from '../lib/store';
import { compressImage } from '../lib/image';

// ------------------------------------------------------------------ buttons
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'soft' | 'danger';
  size?: 'sm' | 'md';
  icon?: ReactNode;
  busy?: boolean;
};
export function Button({ variant = 'soft', size = 'md', icon, busy, children, className = '', ...rest }: BtnProps) {
  return (
    <button className={`btn btn-${variant} btn-${size} ${className}`} disabled={busy || rest.disabled} {...rest}>
      {icon}{children && <span>{children}</span>}
    </button>
  );
}

export function IconButton({ label, children, onClick, className = '' }: { label: string; children: ReactNode; onClick?: () => void; className?: string }) {
  return <button type="button" className={`icon-btn ${className}`} aria-label={label} title={label} onClick={onClick}>{children}</button>;
}

/** Edit + delete buttons for a row (delete asks first). */
export function RowActions({ onEdit, onDelete }: { onEdit?: () => void; onDelete?: () => Promise<void> | void }) {
  return (
    <span className="row-actions">
      {onEdit && <IconButton label={t('common.edit')} onClick={onEdit}><LuPencil /></IconButton>}
      {onDelete && <ConfirmButton label={t('common.delete')} onConfirm={onDelete} />}
    </span>
  );
}

/**
 * Two-tap confirmation without a browser dialog: the first tap turns the
 * button into "Yakin hapus?", a second tap within 4 s does it.
 */
export function ConfirmButton({ label, confirmLabel, onConfirm, children }: {
  label: string; confirmLabel?: string; onConfirm: () => Promise<void> | void; children?: ReactNode;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const id = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(id);
  }, [armed]);
  if (armed) {
    return (
      <button type="button" className="confirm-btn" onClick={async () => { setArmed(false); await onConfirm(); }}>
        <LuTrash2 /> {confirmLabel ?? t('common.confirmDelete')}
      </button>
    );
  }
  return children
    ? <span onClickCapture={(e) => { e.stopPropagation(); e.preventDefault(); setArmed(true); }}>{children}</span>
    : <IconButton label={label} className="danger" onClick={() => setArmed(true)}><LuTrash2 /></IconButton>;
}

// ------------------------------------------------------------------ layout bits
export function Card({ title, actions, children, className = '', pad = true }: {
  title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; pad?: boolean;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="card-head">
          {title && <h2>{title}</h2>}
          {actions && <div className="card-actions">{actions}</div>}
        </header>
      )}
      <div className={pad ? 'card-body' : ''}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function Empty({ children, action }: { children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <svg viewBox="0 0 64 40" width="64" height="40" aria-hidden="true">
        <path d="M4 36h56" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M32 36V22" stroke="currentColor" strokeWidth="2" />
        <path d="M32 24c-6 0-10-4-10-10 6 0 10 4 10 10zM32 20c0-6 4-10 10-10 0 6-4 10-10 10z" fill="currentColor" opacity=".5" />
      </svg>
      <p>{children ?? t('common.empty')}</p>
      {action}
    </div>
  );
}

export function Badge({ tone = 'neutral', children, title }: { tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'info' | 'gold' | 'bloom'; children: ReactNode; title?: string }) {
  return <span className={`badge badge-${tone}`} title={title}>{children}</span>;
}

export function Stat({ label, value, sub, tone }: { label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: string }) {
  return (
    <div className={`stat ${tone ? 'stat-' + tone : ''}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { value: T; label: ReactNode }[] }) {
  return (
    <div className="tabs" role="tablist">
      {items.map((it) => (
        <button key={it.value} role="tab" aria-selected={value === it.value} className={value === it.value ? 'on' : ''} onClick={() => onChange(it.value)}>
          {it.label}
        </button>
      ))}
    </div>
  );
}

export function SiteSelect({ sites, value, onChange, allowAll = true, className = '' }: {
  sites: Site[]; value: string; onChange: (v: string) => void; allowAll?: boolean; className?: string;
}) {
  return (
    <select className={`select ${className}`} value={value} onChange={(e) => onChange(e.target.value)} aria-label={t('common.site')}>
      {allowAll && <option value="all">{t('common.allSites')}</option>}
      {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
    </select>
  );
}

// ------------------------------------------------------------------ modal
export function Modal({ title, onClose, children, footer, wide }: {
  title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('modal-open');
    ref.current?.querySelector<HTMLElement>('input, select, textarea')?.focus();
    return () => { document.removeEventListener('keydown', onKey); document.body.classList.remove('modal-open'); };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" ref={ref}>
        <header className="modal-head">
          <h2>{title}</h2>
          <IconButton label={t('common.close')} onClick={onClose}><LuX /></IconButton>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ photos
/** Shows stored photos (resolves private storage paths to temporary URLs). */
export function PhotoThumbs({ paths, size = 72 }: { paths: string[] | null | undefined; size?: number }) {
  const { repo } = useStore();
  const [urls, setUrls] = useState<string[]>([]);
  const [big, setBig] = useState<string | null>(null);
  const key = (paths ?? []).join('|');
  useEffect(() => {
    let alive = true;
    Promise.all((paths ?? []).map((p) => repo.photoUrl(p).catch(() => ''))).then((u) => alive && setUrls(u.filter(Boolean)));
    return () => { alive = false; };
    // eslint-disable-next-line
  }, [key, repo]);
  if (!paths?.length) return null;
  return (
    <div className="thumbs">
      {urls.map((u, i) => (
        <button type="button" key={i} className="thumb" style={{ width: size, height: size }} onClick={() => setBig(u)}>
          <img src={u} alt="" loading="lazy" />
        </button>
      ))}
      {big && (
        <div className="lightbox" onClick={() => setBig(null)}>
          <img src={big} alt="" />
        </div>
      )}
    </div>
  );
}

/** Pick / take photos, compress and upload them. Value = list of stored paths. */
export function PhotoInput({ value, onChange, max = 4 }: { value: string[]; onChange: (v: string[]) => void; max?: number }) {
  const { repo, toast } = useStore();
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const out = [...value];
      for (const f of Array.from(files).slice(0, max - value.length)) {
        const blob = await compressImage(f);
        out.push(await repo.uploadPhoto(blob, 'image/jpeg'));
      }
      onChange(out);
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };
  return (
    <div className="photo-input">
      {value.map((p, i) => (
        <div key={p + i} className="photo-item">
          <PhotoThumbs paths={[p]} size={64} />
          <button type="button" className="photo-remove" aria-label={t('common.delete')} onClick={() => onChange(value.filter((_, j) => j !== i))}><LuX /></button>
        </div>
      ))}
      {value.length < max && (
        <label className={`photo-add ${busy ? 'busy' : ''}`}>
          <LuCamera />
          <span>{busy ? t('mobile.uploading') : t('common.addPhoto')}</span>
          <input ref={input} type="file" accept="image/*" multiple hidden disabled={busy} onChange={(e) => add(e.target.files)} />
        </label>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ toasts
export function Toasts() {
  const { toasts } = useStore();
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((x) => <div key={x.id} className={`toast toast-${x.kind}`}>{x.text}</div>)}
    </div>
  );
}

/** Horizontal meter (e.g. stock vs minimum). */
export function Meter({ value, max, tone }: { value: number; max: number; tone: 'good' | 'warn' | 'bad' }) {
  const pct = Math.max(2, Math.min(100, (value / (max || 1)) * 100));
  return <div className="meter"><div className={`meter-fill meter-${tone}`} style={{ width: pct + '%' }} /></div>;
}
