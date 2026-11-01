import { normalizeAuditHistory } from './audit';
import { dataSchema } from './models';
import { createDemoData } from './seed';

export const DATA_KEY = 'ems.frontend-demo.v1';

export function loadDemoData() {
  try {
    const raw = localStorage.getItem(DATA_KEY);
    if (!raw) return { data: createDemoData(), warning: '' };
    const parsed = dataSchema.safeParse(JSON.parse(raw));
    if (parsed.success) {
      const audit = normalizeAuditHistory(parsed.data.audit);
      const data = { ...parsed.data, audit };
      if (audit !== parsed.data.audit) {
        try {
          localStorage.setItem(DATA_KEY, JSON.stringify(data));
        } catch {
          return { data, warning: 'Audit categories were updated in memory. Browser storage is unavailable; existing records are unchanged on disk.' };
        }
      }
      return { data, warning: '' };
    }
    return { data: createDemoData(), warning: 'Saved demo data was incompatible. Fresh sample data has been loaded.' };
  } catch {
    return { data: createDemoData(), warning: 'Browser storage is unavailable. This preview will work in memory.' };
  }
}
