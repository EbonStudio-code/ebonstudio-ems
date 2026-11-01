import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../core/ThemeProvider';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === 'dark';
  const label = `Switch to ${dark ? 'light' : 'dark'} theme`;
  return <button type="button" className="theme-toggle" onClick={toggleTheme} aria-label={label} title={label}>
    {dark ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
  </button>;
}
