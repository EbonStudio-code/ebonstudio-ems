import { createContext, useContext, useEffect, useLayoutEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { applyTheme, parseTheme, prefersDarkTheme, readThemePreference, resolveTheme, saveThemePreference, THEME_STORAGE_KEY } from './theme';
import type { Theme } from './theme';

const ThemeContext = createContext<{ theme: Theme; toggleTheme: () => void } | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState(readThemePreference);
  const [systemDark, setSystemDark] = useState(prefersDarkTheme);
  const theme = resolveTheme(preference, systemDark);

  useLayoutEffect(() => { applyTheme(theme); }, [theme]);

  useEffect(() => {
    const media = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    const updateSystem = () => setSystemDark(media?.matches ?? false);
    const syncPreference = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY && event.key !== null) return;
      try {
        if (event.storageArea !== window.localStorage) return;
      } catch {
        return;
      }
      setPreference(event.key === null ? null : parseTheme(event.newValue));
    };
    updateSystem();
    media?.addEventListener('change', updateSystem);
    window.addEventListener('storage', syncPreference);
    return () => {
      media?.removeEventListener('change', updateSystem);
      window.removeEventListener('storage', syncPreference);
    };
  }, []);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setPreference(next);
    saveThemePreference(next);
  }

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('ThemeProvider is missing.');
  return value;
}
