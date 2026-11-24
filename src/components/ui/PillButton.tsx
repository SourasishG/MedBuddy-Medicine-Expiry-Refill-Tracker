'use client';

import {
  useEffect,
  useRef,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
import { useMotionPreference } from '@/hooks/useMotionPreference';
import styles from './PillButton.module.scss';

type BaseProps = {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'subtle';
  size?: 'md' | 'sm';
  className?: string;
};

type ButtonProps = BaseProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> & {
    href?: undefined;
  };

type AnchorProps = BaseProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className'> & {
    href: string;
  };

export type PillButtonProps = ButtonProps | AnchorProps;

export function PillButton(props: PillButtonProps) {
  const { children, variant = 'primary', size = 'md', className, ...rest } = props;
  const elementRef = useRef<HTMLButtonElement | HTMLAnchorElement | null>(null);
  const { motionEnabled, isHydrated } = useMotionPreference();

  useEffect(() => {
    const el: HTMLElement | null = elementRef.current;
    if (!el || !isHydrated || !motionEnabled) return;

    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    if (!finePointer.matches) return;

    let cancelled = false;
    let gsapLoaded = false;
    let xTo: ((val: number) => void) | null = null;
    let yTo: ((val: number) => void) | null = null;

    const handleEnter = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      if (!gsapLoaded) {
        gsapLoaded = true;
        void import('@/lib/gsap').then(({ ensureGsapRegistered, gsap }) => {
          if (cancelled) return;
          ensureGsapRegistered();
          xTo = gsap.quickTo(el, 'x', { duration: 0.45, ease: 'power3.out' });
          yTo = gsap.quickTo(el, 'y', { duration: 0.45, ease: 'power3.out' });
        });
      }
    };

    const handleMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || !xTo || !yTo) return;
      const rect = el.getBoundingClientRect();
      const relX = (event.clientX - rect.left) / rect.width - 0.5;
      const relY = (event.clientY - rect.top) / rect.height - 0.5;
      xTo(relX * 12);
      yTo(relY * 8);
    };

    const handleLeave = () => {
      if (xTo && yTo) {
        xTo(0);
        yTo(0);
      }
    };

    el.addEventListener('pointerenter', handleEnter, { passive: true });
    el.addEventListener('pointermove', handleMove, { passive: true });
    el.addEventListener('pointerleave', handleLeave);

    return () => {
      cancelled = true;
      el.removeEventListener('pointerenter', handleEnter);
      el.removeEventListener('pointermove', handleMove);
      el.removeEventListener('pointerleave', handleLeave);
      if (el) {
        el.style.transform = '';
      }
    };
  }, [isHydrated, motionEnabled]);

  const classes = [styles.pill, styles[variant], styles[size], className].filter(Boolean).join(' ');

  if (typeof props.href === 'string') {
    const { href, ...anchorRest } = rest as Omit<AnchorProps, keyof BaseProps>;
    return (
      <a
        ref={(node) => {
          elementRef.current = node;
        }}
        href={href}
        className={classes}
        data-cursor="interactive"
        {...anchorRest}
      >
        <span className={styles.inner}>{children}</span>
      </a>
    );
  }

  const buttonRest = rest as Omit<ButtonProps, keyof BaseProps>;
  return (
    <button
      ref={(node) => {
        elementRef.current = node;
      }}
      type={buttonRest.type ?? 'button'}
      className={classes}
      data-cursor="interactive"
      {...buttonRest}
    >
      <span className={styles.inner}>{children}</span>
    </button>
  );
}
