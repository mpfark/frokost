// PWA ReloadPrompt - only active in production builds
// In development, the PWA plugin is disabled so virtual:pwa-register/react doesn't exist

export function ReloadPrompt() {
  if (import.meta.env.DEV) {
    return null;
  }

  // Dynamic import is handled by the production build where the PWA plugin is active
  return <ReloadPromptInner />;
}

// Lazy-load the actual implementation only in production
import { lazy, Suspense } from 'react';

const ReloadPromptInner = lazy(() => import('./ReloadPromptImpl'));

export function ReloadPrompt() {
  if (import.meta.env.DEV) return null;
  return (
    <Suspense fallback={null}>
      <ReloadPromptInner />
    </Suspense>
  );
}
