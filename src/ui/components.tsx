import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { create } from 'zustand';
import { useT, type TKey } from './i18n';
import { useSync } from '../data/sync';

// ---------------------------------------------------------------- icons

const PATHS: Record<string, ReactNode> = {
  back: <path d="M15 5l-7 7 7 7" />,
  next: <path d="M9 5l7 7-7 7" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>,
  filter: <path d="M4 6h16M7 12h10M10 18h4" />,
  more: <><circle cx="12" cy="5" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="12" cy="19" r="1.2" /></>,
  share: <><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4" /></>,
  book: <><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" /><path d="M9 9h6M9 13h6" /></>,
  basket: <><path d="M4 10h16l-1.5 9a2 2 0 0 1-2 1.7h-9a2 2 0 0 1-2-1.7z" /><path d="M8 10l4-6 4 6" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" /></>,
  warn: <><path d="M12 3l10 18H2z" /><path d="M12 10v4M12 17.5v.5" /></>,
  chevron: <path d="M6 9l6 6 6-6" />,
  cloudOk: <><path d="M7 18a5 5 0 0 1-.6-10A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9z" /><path d="M9.5 13l2 2 3.5-3.5" /></>,
  cloud: <path d="M7 18a5 5 0 0 1-.6-10A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9z" />,
  cloudOff: <><path d="M7 18a5 5 0 0 1-.6-10A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9z" /><path d="M4 4l16 16" /></>,
  sync: <><path d="M20 12a8 8 0 0 1-14 5.3M4 12A8 8 0 0 1 18 6.7" /><path d="M18 3v4h-4M6 21v-4h4" /></>,
  trash: <><path d="M4 7h16M10 11v6M14 11v6" /><path d="M6 7l1 13h10l1-13M9 7V4h6v3" /></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>,
  bread: <><path d="M4 11a8 5 0 0 1 16 0v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /><path d="M8 12v4M12 12v4M16 12v4" /></>,
  bottle: <><path d="M7 3h10l-1 18H8z" /><path d="M7.5 9h9" /></>,
  box: <><rect x="3" y="7" width="18" height="12" rx="3" /><path d="M3 11h18M9 7V5h6v2" /></>,
  bowl: <><path d="M3 11h18a9 9 0 0 1-18 0z" /><path d="M8 7c0-2 2-2 2-4M13 7c0-2 2-2 2-4" /></>,
  label: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
  db: <><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" /></>,
};

export function Icon({ name, size = 22, strokeWidth = 2, className }: { name: keyof typeof PATHS | string; size?: number; strokeWidth?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      {PATHS[name]}
    </svg>
  );
}

// ---------------------------------------------------------------- layout

export function TopBar({ title, back, actions }: { title: ReactNode; back?: string | true; actions?: ReactNode }) {
  const nav = useNavigate();
  const { t } = useT();
  return (
    <header className="topbar">
      {back && (
        typeof back === 'string'
          ? <Link to={back} className="icon-btn" aria-label={t('back')}><Icon name="back" /></Link>
          : <button className="icon-btn" aria-label={t('back')} onClick={() => nav(-1)}><Icon name="back" /></button>
      )}
      <h1 className="title" style={{ margin: 0 }}>{title}</h1>
      {actions}
    </header>
  );
}

export function BottomNav() {
  const { t } = useT();
  const item = (to: string, icon: string, label: TKey) => (
    <NavLink to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
      <span className="ind"><Icon name={icon} /></span>
      {t(label)}
    </NavLink>
  );
  return (
    <nav className="bottom-nav" aria-label="main">
      {item('/', 'book', 'recipes')}
      {item('/ingredients', 'basket', 'ingredients')}
      {item('/settings', 'gear', 'settings')}
    </nav>
  );
}

export function Empty({ icon, title, hint, action }: { icon: string; title: string; hint: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <Icon name={icon} size={48} strokeWidth={1.4} />
      <h2>{title}</h2>
      <p style={{ margin: 0 }}>{hint}</p>
      {action}
    </div>
  );
}

// ---------------------------------------------------------------- inputs

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  numeric?: boolean;
  suffix?: ReactNode;
  hint?: string;
  error?: string;
  inset?: boolean;
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
  type?: string;
  testId?: string;
}

export function Field({ label, value, onChange, onBlur, numeric, suffix, hint, error, inset, className = '', placeholder, autoFocus, type, testId }: FieldProps) {
  const id = useId();
  return (
    <div className={`field ${inset ? 'inset' : ''} ${error ? 'error' : ''} ${className}`}>
      <label className="label" htmlFor={id}>{label}</label>
      <div className="with-suffix">
        <input
          id={id} value={value} placeholder={placeholder} autoFocus={autoFocus} type={type ?? 'text'}
          inputMode={numeric ? 'decimal' : undefined} className={numeric ? 'num' : ''}
          onChange={(e) => onChange(e.target.value)} onBlur={onBlur} data-testid={testId}
          aria-invalid={!!error} aria-describedby={error || hint ? `${id}-d` : undefined}
        />
        {suffix && <span className="suffix">{suffix}</span>}
      </div>
      {(error || hint) && <span id={`${id}-d`} className={error ? 'err' : 'hint'}>{error || hint}</span>}
    </div>
  );
}

export function SelectField({ label, value, onChange, options, inset }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; inset?: boolean }) {
  const id = useId();
  return (
    <div className={`field ${inset ? 'inset' : ''}`}>
      <label className="label" htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

export function Stepper({ value, onChange, min = 1, label, testId }: { value: number; onChange: (n: number) => void; min?: number; label: string; testId?: string }) {
  const { t } = useT();
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = (s: string) => {
    const n = Number(s);
    if (Number.isFinite(n) && n >= min) onChange(Math.round(n * 100) / 100);
    else setText(String(value));
  };
  return (
    <div className="stepper">
      <button type="button" aria-label={t('decrease')} onClick={() => value - 1 >= min && onChange(value - 1)} disabled={value - 1 < min}>−</button>
      <input aria-label={label} className="num" inputMode="decimal" value={text} data-testid={testId}
        onChange={(e) => setText(e.target.value)} onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
      <button type="button" className="plus" aria-label={t('increase')} onClick={() => onChange(value + 1)}>+</button>
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options, small, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; small?: boolean; label?: string }) {
  return (
    <div className={`segmented ${small ? 'sm' : ''}`} role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- sheet & snackbar

export function Sheet({ open, onClose, title, children, label }: { open: boolean; onClose: () => void; title?: string; children: ReactNode; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="scrim" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label ?? title} ref={ref} tabIndex={-1}>
        <div className="grabber" />
        {title && <h2>{title}</h2>}
        {children}
      </div>
    </div>
  );
}

interface Snack { id: number; text: string; action?: { label: string; run: () => void } }
const useSnack = create<{ snack: Snack | null; show: (s: Omit<Snack, 'id'>) => void; hide: () => void }>((set) => ({
  snack: null,
  show: (s) => set({ snack: { ...s, id: Date.now() } }),
  hide: () => set({ snack: null }),
}));
export const showSnack = (text: string, action?: Snack['action']) => useSnack.getState().show({ text, action });

export function SnackbarHost() {
  const { snack, hide } = useSnack();
  useEffect(() => {
    if (!snack) return;
    const t = setTimeout(hide, 5000);
    return () => clearTimeout(t);
  }, [snack, hide]);
  if (!snack) return null;
  return (
    <div className="snackbar" role="status">
      <span>{snack.text}</span>
      {snack.action && <button onClick={() => { snack.action!.run(); hide(); }}>{snack.action.label}</button>}
    </div>
  );
}

// ---------------------------------------------------------------- sync status

export function SyncPill() {
  const { t } = useT();
  const { state, pending } = useSync();
  const nav = useNavigate();
  let cls = 'ok', icon = 'cloudOk', text = t('synced');
  if (state === 'not_configured') { cls = ''; icon = 'cloud'; text = t('notConnected'); }
  else if (state === 'syncing') { cls = ''; icon = 'sync'; text = t('syncing'); }
  else if (state === 'offline') { cls = 'warn'; icon = 'cloudOff'; text = pending ? t('pendingSync', { n: pending }) : t('offline'); }
  else if (state === 'error') { cls = 'err'; icon = 'warn'; text = t('syncError'); }
  else if (pending) { cls = 'warn'; icon = 'cloud'; text = t('pendingSync', { n: pending }); }
  return (
    <button className={`sync-pill ${cls}`} onClick={() => nav('/settings#sheet')} aria-label={text} data-testid="sync-pill">
      <Icon name={icon} size={16} /> {text}
    </button>
  );
}

/** Thumbnail tint/icon picked from the recipe category so cards are distinguishable without photos. */
export function RecipeThumb({ category, name }: { category?: string; name: string }) {
  const icon = category === 'เครื่องดื่ม' ? 'bottle' : category === 'อาหาร' ? 'bowl' : category === 'ขนม' ? 'bread' : 'box';
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return <div className={`thumb t${h % 4}`}><Icon name={icon} size={36} strokeWidth={1.6} /></div>;
}

// ---------------------------------------------------------------- in-page confirmation (window.confirm is unreliable inside installed/embedded views)

interface Ask { text: string; ok: string; resolve: (v: boolean) => void }
const useAsk = create<{ ask: Ask | null; set: (a: Ask | null) => void }>((set) => ({ ask: null, set: (ask) => set({ ask }) }));
export function askConfirm(text: string, ok: string): Promise<boolean> {
  return new Promise((resolve) => useAsk.getState().set({ text, ok, resolve }));
}
export function ConfirmHost() {
  const { ask, set } = useAsk();
  const { t } = useT();
  const done = (v: boolean) => { ask?.resolve(v); set(null); };
  return (
    <Sheet open={!!ask} onClose={() => done(false)} label={ask?.text}>
      <p style={{ margin: '4px 0 8px', fontSize: 16 }}>{ask?.text}</p>
      <div className="btn-row">
        <button className="btn outline" onClick={() => done(false)}>{t('cancel')}</button>
        <button className="btn" style={{ background: 'var(--danger)', color: '#fff' }} onClick={() => done(true)} data-testid="confirm-ok">{ask?.ok}</button>
      </div>
    </Sheet>
  );
}
