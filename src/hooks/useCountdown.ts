import { useEffect, useState } from 'react';

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

export function useCountdown(targetMs: number) {
  const [remaining, setRemaining] = useState(() => Math.max(targetMs - Date.now(), 0));

  useEffect(() => {
    const id = window.setInterval(() => {
      setRemaining(Math.max(targetMs - Date.now(), 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [targetMs]);

  const totalSeconds = Math.floor(remaining / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    label: `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`,
    hours,
    minutes,
    seconds,
    isOver: remaining <= 0,
  };
}
