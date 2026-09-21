'use client';

import Link from 'next/link';
import React, { createContext, useContext, useId, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import clsx from 'clsx';

/**
 * An expanding navigation rail.
 *
 * On a wide screen it sits collapsed to its icons and widens on hover; below
 * `md` it collapses to a menu button that opens a full-screen drawer — which is
 * also the only navigation this app offers on a phone.
 *
 * Adapted from the Aceternity sidebar to this codebase: it uses the project's
 * semantic colour tokens rather than `dark:` variants (the theme swaps token
 * values, so `dark:` would never fire), and `clsx` rather than a `cn` helper
 * this project does not have.
 */

interface SidebarContextValue {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  animate: boolean;
  /** Ties the menu button to the drawer it controls. */
  drawerId: string;
}

const SidebarContext = createContext<SidebarContextValue | undefined>(undefined);

export function useSidebar(): SidebarContextValue {
  const context = useContext(SidebarContext);
  if (!context) throw new Error('useSidebar must be used inside <Sidebar>');
  return context;
}

export function Sidebar({
  children,
  open: openProp,
  setOpen: setOpenProp,
  animate = true,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) {
  const [openState, setOpenState] = useState(false);
  const drawerId = useId();

  const open = openProp ?? openState;
  const setOpen = setOpenProp ?? setOpenState;

  return (
    <SidebarContext.Provider value={{ open, setOpen, animate, drawerId }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function SidebarBody({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <DesktopSidebar className={className}>{children}</DesktopSidebar>
      <MobileSidebar className={className}>{children}</MobileSidebar>
    </>
  );
}

function DesktopSidebar({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const { open, setOpen, animate } = useSidebar();

  return (
    <motion.aside
      aria-label="Main"
      className={clsx(
        'sticky top-0 hidden h-dvh shrink-0 flex-col gap-6 overflow-hidden',
        'border-e border-line bg-surface/40 px-3 py-4 md:flex',
        className,
      )}
      animate={{ width: animate ? (open ? 248 : 68) : 248 }}
      initial={false}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      // Keyboard users never fire the hover handlers, so focus inside the rail
      // expands it too — otherwise tabbing through hits invisible labels.
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      {children}
    </motion.aside>
  );
}

function MobileSidebar({ className, children }: { className?: string; children: React.ReactNode }) {
  const { open, setOpen, drawerId } = useSidebar();

  return (
    <div className="md:hidden">
      <div className="flex items-center justify-between border-b border-line bg-surface/40 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          aria-expanded={open}
          aria-controls={drawerId}
          className="grid size-9 place-items-center rounded-lg border border-line bg-surface text-ink-muted transition-colors hover:border-line-strong hover:bg-surface-raised hover:text-ink"
        >
          <Menu className="size-4" />
        </button>
      </div>

      <AnimatePresence>
        {open ? (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-canvas/70 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setOpen(false)}
            />

            <motion.div
              id={drawerId}
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
              className={clsx(
                'fixed inset-y-0 start-0 z-50 flex w-72 max-w-[85vw] flex-col gap-6',
                'border-e border-line bg-surface px-4 py-4',
                className,
              )}
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation"
                className="absolute end-3 top-3 grid size-9 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-surface-raised hover:text-ink"
              >
                <X className="size-4" />
              </button>

              {children}
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/**
 * A label that collapses with the rail. It always stays in the DOM so screen
 * readers and keyboard users keep the accessible name.
 */
export function SidebarLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { open, animate } = useSidebar();
  const shown = animate ? open : true;

  return (
    <motion.span
      initial={false}
      animate={{ opacity: shown ? 1 : 0 }}
      transition={{ duration: 0.2 }}
      className={clsx('truncate whitespace-nowrap', className)}
      // Hidden from the pointer while collapsed, but never from assistive tech.
      aria-hidden={false}
    >
      {children}
    </motion.span>
  );
}

export interface SidebarLinkItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

export function SidebarLink({
  link,
  active = false,
  className,
}: {
  link: SidebarLinkItem;
  active?: boolean;
  className?: string;
}) {
  const { setOpen } = useSidebar();

  return (
    <Link
      href={link.href}
      aria-current={active ? 'page' : undefined}
      // On mobile the drawer covers the page, so a tap has to dismiss it.
      onClick={() => setOpen(false)}
      className={clsx(
        'flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors',
        active
          ? 'bg-brand-soft font-medium text-brand'
          : 'text-ink-muted hover:bg-surface-raised hover:text-ink',
        className,
      )}
    >
      <span className="grid size-5 shrink-0 place-items-center">{link.icon}</span>
      <SidebarLabel>{link.label}</SidebarLabel>
    </Link>
  );
}
