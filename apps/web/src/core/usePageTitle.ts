import { useEffect } from 'react';

export function usePageTitle(title: string) {
  useEffect(() => {
    const preview = window.location.pathname === '/preview' || window.location.pathname.startsWith('/preview/');
    document.title = `${title} | Ebon Studio EMS${preview ? ' Preview' : ''}`;
  }, [title]);
}
