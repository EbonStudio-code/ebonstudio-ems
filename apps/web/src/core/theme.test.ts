import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyTheme, initializeTheme, parseTheme, prefersDarkTheme, readThemePreference, resolveTheme, saveThemePreference, THEME_STORAGE_KEY } from './theme';

afterEach(() => { vi.unstubAllGlobals(); });

describe('theme preferences', () => {
  it('accepts only light and dark preferences', () => {
    expect(parseTheme('dark')).toBe('dark');
    expect(parseTheme('light')).toBe('light');
    expect(parseTheme(null)).toBeNull();
    expect(parseTheme('system')).toBeNull();
    expect(parseTheme('invalid')).toBeNull();
  });

  it('respects an explicit choice over the device color scheme', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('uses the device color scheme when there is no saved choice', () => {
    expect(resolveTheme(null, true)).toBe('dark');
    expect(resolveTheme(null, false)).toBe('light');
  });

  it('reads the saved preference from a separate storage key', () => {
    const getItem = vi.fn().mockReturnValue('dark');
    vi.stubGlobal('localStorage', { getItem });
    expect(readThemePreference()).toBe('dark');
    expect(getItem).toHaveBeenCalledWith(THEME_STORAGE_KEY);
    expect(THEME_STORAGE_KEY).not.toBe('ems.frontend-demo.v1');
  });

  it('treats invalid saved preferences as unset', () => {
    vi.stubGlobal('localStorage', { getItem: () => 'not-a-theme' });
    expect(readThemePreference()).toBeNull();
  });

  it('remains usable when storage reads and writes are blocked', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('Storage denied'); },
      setItem: () => { throw new Error('Storage full'); },
    });
    expect(readThemePreference()).toBeNull();
    expect(() => saveThemePreference('dark')).not.toThrow();
  });

  it('persists a theme without touching other demo data', () => {
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', { setItem });
    saveThemePreference('dark');
    expect(setItem).toHaveBeenCalledExactlyOnceWith(THEME_STORAGE_KEY, 'dark');
  });

  it('detects the system preference and tolerates missing matchMedia', () => {
    const matchMedia = vi.fn().mockReturnValue({ matches: true });
    vi.stubGlobal('window', { matchMedia });
    expect(prefersDarkTheme()).toBe(true);
    expect(matchMedia).toHaveBeenCalledWith('(prefers-color-scheme: dark)');
    vi.stubGlobal('window', {});
    expect(prefersDarkTheme()).toBe(false);
  });

  it('updates the root theme and browser toolbar color', () => {
    const dataset: Record<string, string> = {};
    const setAttribute = vi.fn();
    vi.stubGlobal('document', { documentElement: { dataset }, querySelector: () => ({ setAttribute }) });
    applyTheme('dark');
    expect(dataset.theme).toBe('dark');
    expect(setAttribute).toHaveBeenLastCalledWith('content', '#0e0e10');
    applyTheme('light');
    expect(dataset.theme).toBe('light');
    expect(setAttribute).toHaveBeenLastCalledWith('content', '#f5f3ef');
  });

  it('initializes the root before React renders and works without a theme meta tag', () => {
    const dataset: Record<string, string> = {};
    vi.stubGlobal('document', { documentElement: { dataset }, querySelector: () => null });
    vi.stubGlobal('localStorage', { getItem: () => 'dark' });
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
    initializeTheme();
    expect(dataset.theme).toBe('dark');
  });
});
