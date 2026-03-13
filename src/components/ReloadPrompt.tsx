import { useRegisterSW } from 'virtual:pwa-register/react';
import { toast } from 'sonner';
import { useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';

const CHECK_INTERVAL_MS = 5 * 60 * 1000;

export function ReloadPrompt() {
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      if (import.meta.env.DEV) return; // Skip periodic checks in dev
      console.log('SW registered:', swUrl);
      if (registration) {
        setInterval(() => {
          console.log('Checking for SW updates...');
          registration.update();
        }, CHECK_INTERVAL_MS);
      }
    },
    onRegisterError(error) {
      if (import.meta.env.DEV) return; // Suppress errors in dev
      console.error('SW registration error:', error);
    },
  });

  const handleUpdate = useCallback(() => {
    updateServiceWorker(true);
  }, [updateServiceWorker]);

  useEffect(() => {
    if (needRefresh) {
      toast('Ny version tilgængelig', {
        description: 'En opdatering er klar til installation.',
        duration: Infinity,
        action: {
          label: 'Opdater nu',
          onClick: handleUpdate,
        },
        icon: <RefreshCw className="w-4 h-4" />,
      });
    }
  }, [needRefresh, handleUpdate]);

  useEffect(() => {
    if (offlineReady) {
      toast.success('Klar til offline', {
        description: 'Appen kan nu bruges uden internet.',
        duration: 3000,
      });
    }
  }, [offlineReady]);

  return null;
}
