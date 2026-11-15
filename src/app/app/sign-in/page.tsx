'use client';

import { Suspense, useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { safeNextPath } from '@/lib/safe-redirect';
import styles from './sign-in.module.scss';

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = safeNextPath(searchParams.get('next'));
  const urlError = searchParams.get('error');

  const supabase = createClient();
  const [, startTransition] = useTransition();

  const queryStep = searchParams.get('step');
  const queryEmail = searchParams.get('email') || '';

  const [email, setEmail] = useState(queryEmail);
  const [otpCode, setOtpCode] = useState('');
  const [step, setStep] = useState<'email' | 'otp'>(() => (queryStep === 'otp' ? 'otp' : 'email'));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(() => {
    if (urlError === 'auth_callback_failed') {
      return 'Could not sign you in with Google. Please try again or use an email code.';
    }
    return null;
  });
  const [resendCooldown, setResendCooldown] = useState(0);

  // Check if already authenticated on mount
  useEffect(() => {
    async function checkAuth() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        startTransition(() => {
          router.replace(nextUrl);
        });
      }
    }
    void checkAuth();
  }, [supabase, router, nextUrl]);

  // Cooldown countdown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Handle Google OAuth
  const handleGoogleSignIn = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    const redirectUrl = `${window.location.origin}/app/auth/callback${
      nextUrl !== '/app' ? `?next=${encodeURIComponent(nextUrl)}` : ''
    }`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
      },
    });

    if (error) {
      setIsSubmitting(false);
      setErrorMessage('Could not start Google sign in. Please try again or use an email code.');
    }
  };

  // Handle Sending Email OTP
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          shouldCreateUser: true,
        },
      });

      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes('rate') || msg.includes('too many') || error.status === 429) {
          setErrorMessage('Too many sign-in attempts. Please wait a minute before trying again.');
        } else {
          setErrorMessage('Could not send code. Please check your email address and try again.');
        }
        setIsSubmitting(false);
        return;
      }

      setStep('otp');
      setResendCooldown(30);
      setIsSubmitting(false);
    } catch {
      setErrorMessage('Something went wrong. Please check your connection and try again.');
      setIsSubmitting(false);
    }
  };

  // Handle Verifying OTP Code
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = otpCode.trim();
    if (cleanCode.length !== 6) {
      setErrorMessage('Please enter the 6-digit verification code.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: cleanCode,
        type: 'email',
      });

      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes('expired')) {
          setErrorMessage('That code has expired. Please request a fresh code.');
        } else if (msg.includes('invalid') || msg.includes('token') || msg.includes('match')) {
          setErrorMessage('That code does not match. Check the numbers or request a new code.');
        } else if (msg.includes('rate') || error.status === 429) {
          setErrorMessage('Too many attempts. Please wait a moment before trying again.');
        } else {
          setErrorMessage('Could not verify code. Please check the code and try again.');
        }
        setIsSubmitting(false);
        return;
      }

      if (data.session || data.user) {
        startTransition(() => {
          router.replace(nextUrl);
        });
      }
    } catch {
      setErrorMessage('Connection error. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.brandHeader}>
          <div className={styles.markRing} aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 64 64" fill="none">
              <rect
                x="21"
                y="26"
                width="22"
                height="12"
                rx="6"
                transform="rotate(-35 32 32)"
                stroke="#EAF0F6"
                strokeWidth="2.4"
              />
              <circle cx="38" cy="26" r="3.4" fill="#5CF2C7" />
            </svg>
          </div>
          <h1 className={styles.title}>
            {step === 'email' ? 'Welcome to MedBuddy' : 'Check your email'}
          </h1>
          <p className={styles.subtitle}>
            {step === 'email'
              ? 'Your calm medicine expiry, dose, and refill tracker.'
              : `We sent a 6-digit code to ${email}`}
          </p>
        </div>

        {errorMessage && (
          <div className={styles.errorBox} role="alert">
            <svg
              className={styles.errorIcon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{errorMessage}</span>
          </div>
        )}

        {step === 'email' ? (
          <>
            <button
              type="button"
              className={styles.oauthBtn}
              onClick={handleGoogleSignIn}
              disabled={isSubmitting}
            >
              <svg className={styles.googleIcon} viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3h3.86c2.26-2.09 3.68-5.17 3.68-9.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.37 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.61H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.39l3.98-3.1z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.37 0 3.26 2.7 1.29 6.61l3.98 3.1c.95-2.85 3.6-4.96 6.73-4.96z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            <div className={styles.divider} aria-hidden="true">
              or
            </div>

            <form onSubmit={handleSendOtp} className={styles.form} noValidate>
              <div className={styles.inputGroup}>
                <label htmlFor="email-input" className={styles.label}>
                  Email address
                </label>
                <input
                  id="email-input"
                  type="email"
                  className={styles.input}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
                {isSubmitting ? 'Sending code…' : 'Email me a code'}
              </button>
            </form>
          </>
        ) : (
          <form onSubmit={handleVerifyOtp} className={styles.form} noValidate>
            <div className={styles.inputGroup}>
              <label htmlFor="otp-input" className={styles.label}>
                6-digit code
              </label>
              <input
                id="otp-input"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                className={styles.otpInput}
                placeholder="123456"
                autoComplete="one-time-code"
                autoFocus
                required
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                disabled={isSubmitting}
              />
            </div>

            <button
              type="submit"
              className={styles.submitBtn}
              disabled={isSubmitting || otpCode.trim().length !== 6}
            >
              {isSubmitting ? 'Verifying…' : 'Verify & Continue'}
            </button>

            <div className={styles.actionRow}>
              <button
                type="button"
                className={styles.linkBtn}
                onClick={() => {
                  setStep('email');
                  setOtpCode('');
                  setErrorMessage(null);
                }}
                disabled={isSubmitting}
              >
                Change email
              </button>

              <button
                type="button"
                className={styles.linkBtn}
                onClick={() => handleSendOtp()}
                disabled={isSubmitting || resendCooldown > 0}
              >
                {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
              </button>
            </div>
          </form>
        )}

        <div className={styles.disclaimer}>
          By signing in, you agree to our Terms and have read our{' '}
          <Link href="/privacy">Privacy Notice</Link>. MedBuddy is not a substitute for medical
          advice.
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.container}>
          <div className={styles.card}>
            <div className={styles.title}>Loading…</div>
          </div>
        </div>
      }
    >
      <SignInContent />
    </Suspense>
  );
}
