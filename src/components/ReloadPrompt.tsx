import { useRegisterSW } from 'virtual:pwa-register/react';
import { toast } from 'sonner';
import { useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';

// Check for updates every 5 minutes
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

export function ReloadPrompt() {
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      console.log('SW registered:', swUrl);
      if (registration) {
        // Periodically check for updates
        setInterval(() => {
          console.log('Checking for SW updates...');
          registration.update();
        }, CHECK_INTERVAL_MS);
      }
    },
    onRegisterError(error) {
      console.error('SW registration error:', error);
    },
  });

  const handleUpdate = useCallback(() => {
    updateServiceWorker(true); // true = reload page after update
  }, [updateServiceWorker]);

  // Show toast when new version is available
  useEffect(() => {
    if (needRefresh) {
      toast('Ny version tilgængelig', {
        description: 'En opdatering er klar til installation.',
        duration: Infinity, // Don't auto-dismiss
        action: {
          label: 'Opdater nu',
          onClick: handleUpdate,
        },
        icon: <RefreshCw className="w-4 h-4" />,
      });
    }
  }, [needRefresh, handleUpdate]);

  // Show offline ready notification
  useEffect(() => {
    if (offlineReady) {
      toast.success('Klar til offline', {
        description: 'Appen kan nu bruges uden internet.',
        duration: 3000,
      });
    }
  }, [offlineReady]);

  return null; // Component handles toasts, no visible UI
}
