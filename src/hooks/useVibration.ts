import { useCallback } from 'react';

interface UseVibrationReturn {
  vibrate: (pattern?: number | number[]) => void;
  vibrateSuccess: () => void;
  vibrateError: () => void;
}

export function useVibration(): UseVibrationReturn {
  const vibrate = useCallback((pattern: number | number[] = 200) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  }, []);

  const vibrateSuccess = useCallback(() => {
    vibrate([100, 50, 100]);
  }, [vibrate]);

  const vibrateError = useCallback(() => {
    vibrate(300);
  }, [vibrate]);

  return {
    vibrate,
    vibrateSuccess,
    vibrateError,
  };
}
