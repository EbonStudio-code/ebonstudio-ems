import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ThemeProvider } from './core/ThemeProvider';
import { initializeTheme } from './core/theme';
import './fonts.css';
import './styles.css';

initializeTheme();

createRoot(document.getElementById('root')!).render(<StrictMode><ThemeProvider><App /></ThemeProvider></StrictMode>);
