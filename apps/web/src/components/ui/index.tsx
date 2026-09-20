import clsx from 'clsx';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

export function Card({
  className,
  children,
  ...rest
}: ComponentPropsWithoutRef<'section'>): ReactNode {
  return (
    <section className={clsx('card p-5', className)} {...rest}>
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}): ReactNode {
  return (
    <header className="mb-4 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold tracking-tight text-ink">{title}</h2>
        {description ? <p className="mt-1 text-xs text-ink-subtle">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-canvas hover:bg-brand-strong font-semibold',
  secondary: 'bg-surface-raised text-ink hover:bg-surface-overlay border border-line',
  ghost: 'text-ink-muted hover:text-ink hover:bg-surface-raised',
  danger: 'bg-loss-soft text-loss hover:bg-loss hover:text-canvas border border-loss/40',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...rest
}: ComponentPropsWithoutRef<'button'> & {
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
}): ReactNode {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-lg transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm',
        BUTTON_VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Input({ className, ...rest }: ComponentPropsWithoutRef<'input'>): ReactNode {
  return (
    <input
      className={clsx(
        'w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink',
        'placeholder:text-ink-subtle',
        'focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand',
        'disabled:opacity-50',
        className,
      )}
      {...rest}
    />
  );
}

export function Select({
  className,
  children,
  ...rest
}: ComponentPropsWithoutRef<'select'>): ReactNode {
  return (
    <select
      className={clsx(
        'w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink',
        'focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand',
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  );
}

export function Textarea({ className, ...rest }: ComponentPropsWithoutRef<'textarea'>): ReactNode {
  return (
    <textarea
      className={clsx(
        'w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink',
        'placeholder:text-ink-subtle',
        'focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand',
        className,
      )}
      {...rest}
    />
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}): ReactNode {
  return (
    <label className={clsx('block', className)}>
      <span className="mb-1.5 block text-xs font-medium text-ink-muted">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-loss">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-ink-subtle">{hint}</span>
      ) : null}
    </label>
  );
}

type BadgeTone = 'neutral' | 'profit' | 'loss' | 'brand' | 'warning';

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-raised text-ink-muted border-line',
  profit: 'bg-profit-soft text-profit border-profit/30',
  loss: 'bg-loss-soft text-loss border-loss/30',
  brand: 'bg-brand-soft text-brand border-brand/30',
  warning: 'bg-warning/15 text-warning border-warning/30',
};

export function Badge({
  tone = 'neutral',
  className,
  children,
  style,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
  style?: React.CSSProperties;
}): ReactNode {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium',
        BADGE_TONES[tone],
        className,
      )}
      style={style}
    >
      {children}
    </span>
  );
}

/** The empty state every list falls back to, so none of them invent their own. */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}): ReactNode {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      {description ? <p className="max-w-sm text-xs text-ink-subtle">{description}</p> : null}
      {action}
    </div>
  );
}

export function Spinner({ className }: { className?: string }): ReactNode {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={clsx(
        'inline-block size-4 animate-spin rounded-full border-2 border-line border-t-brand',
        className,
      )}
    />
  );
}

/** A labelled figure. The single way a number is presented in this app. */
export function Stat({
  label,
  value,
  sub,
  tone = 'flat',
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  /** Matches pnlTone's three states so a P&L figure can pass its tone straight through. */
  tone?: 'flat' | 'profit' | 'loss';
}): ReactNode {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium text-ink-subtle">{label}</p>
      <p
        className={clsx(
          'numeric mt-2 text-2xl font-semibold tracking-tight',
          tone === 'profit' && 'text-profit',
          tone === 'loss' && 'text-loss',
          tone === 'flat' && 'text-ink',
        )}
      >
        {value}
      </p>
      {sub ? <p className="mt-1 text-xs text-ink-subtle">{sub}</p> : null}
    </div>
  );
}
