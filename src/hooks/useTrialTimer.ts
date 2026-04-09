import { useEffect, useRef, useCallback } from "react";

const STORAGE_KEY = "myloopio_trial_used_seconds";
const TRIAL_LIMIT = 3600; // 60 minutes in seconds

function getUsedSeconds(): number {
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    return val ? Math.max(0, parseInt(val, 10) || 0) : 0;
  } catch {
    return 0;
  }
}

function saveUsedSeconds(seconds: number) {
  try {
    localStorage.setItem(STORAGE_KEY, String(Math.floor(seconds)));
  } catch {
    // silent
  }
}

export function useTrialTimer(isPlaying: boolean, onExpired?: () => void) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const usedRef = useRef(getUsedSeconds());
  const onExpiredRef = useRef(onExpired);
  onExpiredRef.current = onExpired;

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (isPlaying && usedRef.current < TRIAL_LIMIT) {
      intervalRef.current = setInterval(() => {
        usedRef.current += 1;
        saveUsedSeconds(usedRef.current);
        console.log(`[Trial] ${usedRef.current}/${TRIAL_LIMIT}s used`);
        if (usedRef.current >= TRIAL_LIMIT) {
          console.log("[Trial] Limit reached — stopping playback");
          stop();
          onExpiredRef.current?.();
        }
      }, 1000);
    } else {
      stop();
    }
    return stop;
  }, [isPlaying, stop]);

  return {
    usedSeconds: usedRef.current,
    limitSeconds: TRIAL_LIMIT,
    isExpired: () => getUsedSeconds() >= TRIAL_LIMIT,
    getUsed: () => getUsedSeconds(),
  };
}
