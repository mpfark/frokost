import { lazy, Suspense } from 'react';

const ReloadPromptImpl = lazy(() => import('./ReloadPromptImpl'));

export function ReloadPrompt() {
  if (import.meta.env.DEV) return null;
  return (
    <Suspense fallback={null}>
      <ReloadPromptImpl />
    </Suspense>
  );
}
