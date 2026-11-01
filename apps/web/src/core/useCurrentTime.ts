import { useEffect, useState } from 'react';

// Display only. Clock actions continue to use the saved attendance response.
export function useCurrentTime(interval = 1000) {
  const [now,setNow] = useState(() => new Date());
  useEffect(() => {
    const update = () => { if (document.visibilityState === 'visible') setNow(new Date()); };
    const timer = window.setInterval(update, interval);
    window.addEventListener('focus',update);
    document.addEventListener('visibilitychange',update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus',update);
      document.removeEventListener('visibilitychange',update);
    };
  },[interval]);
  return now;
}
