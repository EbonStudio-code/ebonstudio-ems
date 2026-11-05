import { createContext, useContext } from 'react';
import type { DemoStore } from './store';

export const DemoContext = createContext<DemoStore | null>(null);
export function useDemo() {
  const value = useContext(DemoContext);
  if (!value) throw new Error('DemoProvider is missing.');
  return value;
}
