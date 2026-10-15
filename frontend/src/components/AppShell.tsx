'use client';

import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useAuth } from '@/context/AuthContext';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { onboardingApi } from '@/lib/api';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const isAuthPage = pathname === '/login' || pathname === '/signup';
  const isOnboardingPage = pathname === '/onboarding';
  const isPricingFromOnboarding = pathname === '/pricing' && searchParams?.get('source') === 'onboarding';
  const isFullscreenPage = isOnboardingPage || isPricingFromOnboarding;

  // Track onboarding check so we don't re-run on every render
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const checkingRef = useRef(false);

  // After auth resolves, check if onboarding is complete for authenticated non-onboarding routes
  useEffect(() => {
    if (loading) return;

    // Not logged in — redirect to login (but skip for auth pages)
    if (!user && !isAuthPage) {
      router.replace('/login');
      return;
    }

    // Logged in and on an auth page — let login/signup page handle its own redirect
    if (user && isAuthPage) return;

    // On a fullscreen (onboarding/pricing) page — no onboarding guard needed
    if (isFullscreenPage) return;

    // Already checked in this session
    if (onboardingChecked) return;

    // Guard: prevent concurrent checks
    if (checkingRef.current) return;
    checkingRef.current = true;

    // Check onboarding status for all app pages
    onboardingApi.getProgress()
      .then((data) => {
        setOnboardingChecked(true);
        if (!data.isCompleted) {
          router.replace('/onboarding');
        }
      })
      .catch(() => {
        // If the API fails we can't know the state — send to onboarding to be safe
        setOnboardingChecked(true);
        router.replace('/onboarding');
      })
      .finally(() => {
        checkingRef.current = false;
      });
  }, [loading, user, isAuthPage, isFullscreenPage, onboardingChecked, router]);

  // Reset the check only when user identity changes (login/logout)
  // NOT on pathname changes — the check is per-session, not per-navigation
  const prevUserRef = useRef<string | null>(null);
  useEffect(() => {
    const userId = user?.id ?? null;
    if (prevUserRef.current !== userId) {
      prevUserRef.current = userId;
      setOnboardingChecked(false);
    }
  }, [user]);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center" style={{ backgroundColor: 'var(--bg)' }}>
        <div className="flex flex-col items-center gap-4">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ background: 'linear-gradient(135deg, var(--primary), #E8734F)', boxShadow: 'var(--shadow-button)' }}
          >
            <span className="text-white text-xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>R</span>
          </div>
          <div className="flex gap-1.5">
            {[0, 1, 2].map(i => (
              <span
                key={i}
                className="inline-block h-2 w-2 rounded-full"
                style={{
                  backgroundColor: 'var(--primary)',
                  animation: `pulse 1.2s ease-in-out infinite`,
                  animationDelay: `${i * 0.15}s`,
                  opacity: 0.4,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isAuthPage) return <>{children}</>;
  if (!user) return null;
  if (isFullscreenPage) return <>{children}</>;

  // While we're still checking onboarding, show the app loader (avoids flash of sidebar)
  if (!onboardingChecked) {
    return (
      <div className="flex h-screen w-screen items-center justify-center" style={{ backgroundColor: 'var(--bg)' }}>
        <div className="flex flex-col items-center gap-4">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ background: 'linear-gradient(135deg, var(--primary), #E8734F)', boxShadow: 'var(--shadow-button)' }}
          >
            <span className="text-white text-xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>R</span>
          </div>
          <div className="flex gap-1.5">
            {[0, 1, 2].map(i => (
              <span
                key={i}
                className="inline-block h-2 w-2 rounded-full"
                style={{
                  backgroundColor: 'var(--primary)',
                  animation: `pulse 1.2s ease-in-out infinite`,
                  animationDelay: `${i * 0.15}s`,
                  opacity: 0.4,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--bg)' }}>
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <Topbar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
