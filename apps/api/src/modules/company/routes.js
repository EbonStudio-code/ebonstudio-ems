import { Router } from 'express';
import { z, object, text, optionalText, version, parse, send, pageQuery, list, uuid, date } from '../../core/validation.js';
import { role } from '../identity/session.js';
import { transaction, audit } from '../../core/transactions.js';
import { checkVersion, fail } from '../../core/errors.js';
import { company, companyPublic } from './service.js';

const fields = {
  displayName: text(), legalName: optionalText(200), statementAddress: optionalText(500),
  timezone: text(100).refine(value => { try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; } }),
  workingWeekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7).refine(v => new Set(v).size === v.length),
  currencyCode: z.string().regex(/^[A-Z]{3}$/).refine(v => Intl.supportedValuesOf('currency').includes(v)),
  currencyMinorUnit: z.number().int().min(0).max(3),
  leaveTypes: z.array(text(60)).min(1).max(20).refine(v => new Set(v).size === v.length),
  salaryPublicationEnabled: z.boolean(), salaryJurisdiction: optionalText(200),
};
export function companyRoutes({ pool, guards }) {
  const router = Router();
  router.get('/company', async (req, res) => send(res, companyPublic(await company(pool))));
  router.patch('/company', role('CEO'), async (req, res) => {
    const data = parse(object({ ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.optional()])), version }), req.body);
    const result = await transaction(pool, async db => {
      const existing = (await db.query('SELECT * FROM company_settings WHERE id=true')).rows[0];
      if (existing) checkVersion(existing, data.version);
      else if (data.version !== 0) fail(409, 'VERSION_CONFLICT', 'Initial company version must be zero');
      const merged = {};
      for (const key of Object.keys(fields)) {
        const column = key.replace(/[A-Z]/g, c => '_' + c.toLowerCase());
        merged[key] = data[key] ?? existing?.[column];
      }
      const settings = parse(object(fields), merged);
      settings.workingWeekdays.sort();
      const minor = new Intl.NumberFormat('en', { style: 'currency', currency: settings.currencyCode }).resolvedOptions().maximumFractionDigits;
      if (minor !== settings.currencyMinorUnit) fail(422, 'INVALID_CURRENCY_PRECISION', 'Currency precision must match the currency');
      if (settings.salaryPublicationEnabled && (!settings.legalName || !settings.statementAddress || !settings.salaryJurisdiction)) {
        fail(422, 'PUBLICATION_NOT_READY', 'Legal name, address, and reviewed jurisdiction are required for publication');
      }
      if (existing) {
        const locks = await guards.companyLocks(db);
        const calendarChange = settings.timezone !== existing.timezone ||
          [...settings.workingWeekdays].sort().join() !== [...existing.working_weekdays].sort().join();
        if (locks.calendar && calendarChange) fail(409, 'CALENDAR_LOCKED', 'Timezone/workweek are locked after attendance or leave exists');
        if (locks.currency && (settings.currencyCode !== existing.currency_code || settings.currencyMinorUnit !== existing.currency_minor_unit)) {
          fail(409, 'CURRENCY_LOCKED', 'Currency is locked after the first salary draft');
        }
      }
      const values = Object.keys(fields).map(key => settings[key]);
      const saved = await db.query(`INSERT INTO company_settings
        (display_name,legal_name,statement_address,timezone,working_weekdays,currency_code,currency_minor_unit,leave_types,
        salary_publication_enabled,salary_jurisdiction,version)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,1)
        ON CONFLICT(id) DO UPDATE SET display_name=$1,legal_name=$2,statement_address=$3,timezone=$4,working_weekdays=$5,
        currency_code=$6,currency_minor_unit=$7,leave_types=$8,salary_publication_enabled=$9,salary_jurisdiction=$10,
        version=company_settings.version+1,calendar_guard=company_settings.calendar_guard+1,
        calendar_revision=company_settings.calendar_revision+CASE WHEN company_settings.timezone<>$4
          OR company_settings.working_weekdays<>$5::integer[] THEN 1 ELSE 0 END,updated_at=now() RETURNING *`, values);
      await audit(db, req.actor, 'company', existing ? 'COMPANY_UPDATED' : 'COMPANY_CONFIGURED', null);
      return companyPublic(saved.rows[0]);
    }, req.actor);
    send(res, result);
  });
  router.get('/audit-events', role('CEO'), async (req, res) => {
    const query = pageQuery(req, { entityId: uuid.optional(), module: text(50).optional(), action: text(80).optional(), from: date.optional(), to: date.optional() });
    const values = [query.entityId || null, query.module || null, query.action || null, query.from || null, query.to || null];
    res.json(await list(pool, `SELECT id,actor_user_id,action,module,entity_id,request_id,reason,created_at FROM audit_events
      WHERE ($1::uuid IS NULL OR entity_id=$1) AND ($2::text IS NULL OR module=$2) AND ($3::text IS NULL OR action=$3)
      AND ($4::date IS NULL OR created_at >= $4::date) AND ($5::date IS NULL OR created_at < $5::date+interval '1 day')
      ORDER BY created_at DESC,id DESC`, values, query));
  });
  return router;
}
