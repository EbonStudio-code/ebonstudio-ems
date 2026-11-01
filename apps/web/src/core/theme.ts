export type Theme = 'light' | 'dark';
export const THEME_STORAGE_KEY = 'ems.theme';

export function parseTheme(value: string | null): Theme | null {
  return value === 'light' || value === 'dark' ? value : null;
}

export function readThemePreference(): Theme | null {
  try {
    return parseTheme(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function prefersDarkTheme() {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function resolveTheme(preference: Theme | null, systemDark: boolean): Theme {
  return preference ?? (systemDark ? 'dark' : 'light');
}

export function saveThemePreference(theme: Theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Keep the selected theme usable in memory when browser storage is blocked.
  }
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0e0e10' : '#f5f3ef');
}

export function initializeTheme() {
  applyTheme(resolveTheme(readThemePreference(), prefersDarkTheme()));
}
