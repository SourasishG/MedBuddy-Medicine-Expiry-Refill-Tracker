'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt: () => Promise<void>;
}

export type InstallSituation =
  | 'standalone'
  | 'prompt-available'
  | 'ios-safari'
  | 'ios-non-safari'
  | 'desktop-qr'
  | 'unsupported';

const emptySubscribe = () => () => {};

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const mediaStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const navStandalone = Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return mediaStandalone || navStandalone;
}

function readPreviewOverride(): InstallSituation | null {
  if (typeof window === 'undefined') return null;
  try {
    const param = new URLSearchParams(window.location.search).get('installPreview');
    if (
      param === 'standalone' ||
      param === 'prompt-available' ||
      param === 'ios-safari' ||
      param === 'ios-non-safari' ||
      param === 'desktop-qr' ||
      param === 'unsupported'
    ) {
      return param;
    }
  } catch {
    // Ignore query parse failures
  }
  return null;
}

function detectPlatformSituation(hasNativePrompt: boolean, standalone: boolean): InstallSituation {
  const override = readPreviewOverride();
  if (override) return override;
  if (standalone) return 'standalone';
  if (hasNativePrompt) return 'prompt-available';

  if (typeof navigator === 'undefined' || typeof window === 'undefined') {
    return 'desktop-qr';
  }

  const ua = navigator.userAgent || '';
  const isTouchMac = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  const isIOS = /iPad|iPhone|iPod/i.test(ua) || isTouchMac;

  if (isIOS) {
    const isOtherIosBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/i.test(ua);
    const isSafari = /Safari/i.test(ua) && !isOtherIosBrowser;
    return isSafari ? 'ios-safari' : 'ios-non-safari';
  }

  const isMobileAndroid = /Android/i.test(ua);
  const isDesktopViewport = window.matchMedia('(min-width: 960px)').matches;

  if (!isMobileAndroid && isDesktopViewport) {
    return 'desktop-qr';
  }

  return 'unsupported';
}

export function useInstallPrompt() {
  const router = useRouter();
  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installedStandalone, setInstalledStandalone] = useState<boolean>(false);
  const [justInstalled, setJustInstalled] = useState<boolean>(false);
  const [modalOpen, setModalOpen] = useState<boolean>(false);

  useEffect(() => {
    const media = window.matchMedia('(display-mode: standalone)');
    const syncStandalone = () => {
      setInstalledStandalone(detectStandalone());
    };
    syncStandalone();

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const onAppInstalled = () => {
      setDeferredPrompt(null);
      setJustInstalled(true);
      setInstalledStandalone(true);
    };

    media.addEventListener('change', syncStandalone);
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);

    return () => {
      media.removeEventListener('change', syncStandalone);
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  const situation: InstallSituation = isClient
    ? detectPlatformSituation(Boolean(deferredPrompt), installedStandalone)
    : 'desktop-qr';

  const siteUrl = isClient ? window.location.origin : 'https://medbuddy.app';

  const ctaLabel =
    situation === 'standalone'
      ? 'Open MedBuddy'
      : situation === 'unsupported'
        ? 'How to install'
        : 'Install MedBuddy';

  const ctaHref = situation === 'standalone' ? '/app' : undefined;

  const handleInstall = useCallback(async () => {
    if (situation === 'standalone') {
      router.push('/app');
      return;
    }

    if (situation === 'prompt-available' && deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setJustInstalled(true);
        }
        setDeferredPrompt(null);
      } catch {
        setModalOpen(true);
      }
      return;
    }

    setModalOpen(true);
  }, [deferredPrompt, router, situation]);

  return {
    situation,
    isStandalone: situation === 'standalone',
    justInstalled,
    ctaLabel,
    ctaHref,
    siteUrl,
    modalOpen,
    setModalOpen,
    handleInstall,
  };
}
