"use client";
import { useEffect } from 'react';

export default function GlobalWakeLock() {
  useEffect(() => {
    let wakeLock: any = null;

    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await navigator.wakeLock.request('screen');
          console.log('Global Wake Lock active: Site will not sleep.');

          wakeLock.addEventListener('release', () => {
            console.log('Global Wake Lock released.');
          });
        }
      } catch (err: any) {
        console.error(`Wake Lock error: ${err.message}`);
      }
    };

    // Re-acquire the lock if the user leaves the tab and comes back
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };

    // Trigger on first load
    requestWakeLock();

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup when the app unmounts
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLock) {
        wakeLock.release().catch(console.error);
      }
    };
  }, []);

  return null; // Invisible component
}