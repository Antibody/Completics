// hooks/useIsMobile.ts

// Lightweight viewport-width hook for responsive logic; no external deps.
import { useEffect, useState } from 'react';

export const useIsMobile = (breakpoint = 767): boolean => {
  const [isMobile, setIsMobile] = useState<boolean>(
    typeof window !== 'undefined' ? window.innerWidth <= breakpoint : false,
  );

  useEffect(() => {
    const handler = (): void => setIsMobile(window.innerWidth <= breakpoint);
    handler();
    window.addEventListener('resize', handler);
    return (): void => window.removeEventListener('resize', handler);
  }, [breakpoint]);

  return isMobile;
};
