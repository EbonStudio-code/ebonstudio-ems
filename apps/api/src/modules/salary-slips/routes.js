import { Router } from 'express';
import { z, object, text, optionalText, uuid, period, version, reason, parse, id, send, pageQuery, list } from '../../core/validation.js';
import { role, rateLimit } from '../identity/session.js';
import { company } from '../company/service.js';
import { employee } from '../employees/service.js';
import { transaction, audit } from '../../core/transactions.js';
import { checkVersion, fail } from '../../core/errors.js';
import { salarySlip, salaryQuery, totals, snapshots } from './service.js';
import { statementPdf } from './pdf.js';

const line = object({ label: text(80), amountMinor: z.number().int().min(0).max(1000000000000) });
const financials = { earnings: z.array(line).min(1).max(20), deductions: z.array(line).max(20), note: optionalText(1000).default('') };
export function salaryRoutes({ pool, config }) {
  const router = Router();
  router.get('/', async (req, res) => {
    const q = pageQuery(req, { employeeId: uuid.optional(), period: period.optional(), state: z.enum(['DRAFT','PUBLISHED','VOIDED']).optional() });
    res.json(await list(pool, salaryQuery + ` WHERE ($1='CEO' OR (e.user_id=$2 AND s.state IN ('PUBLISHED','VOIDED')))
      AND ($3::uuid IS NULL OR s.employee_id=$3) AND ($4::text IS NULL OR s.period=$4) AND ($5::text IS NULL OR s.state=$5)
      ORDER BY s.period DESC,s.revision DESC,s.id`, [req.actor.role, req.actor.id, q.employeeId || null, q.period || null, q.state || null], q));
  });
  router.post('/', role('CEO'), async (req, res) => {
    const data = parse(object({ employeeId: uuid, period, ...financials }), req.body);
    const sum = totals(data.earnings, data.deductions);
    const row = await transaction(pool, async db => {
      const settings = await company(db);
      await employee(db, data.employeeId);
      const revision = (await db.query('SELECT COALESCE(max(revision),0)+1 AS next FROM salary_slips WHERE employee_id=$1 AND period=$2', [data.employeeId, data.period])).rows[0].next;
      const result = await db.query(`INSERT INTO salary_slips(employee_id,created_by_user_id,period,revision,currency_code,currency_minor_unit,earnings,deductions,gross,deduction_total,net,note)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [data.employeeId, req.actor.id, data.period, revision, settings.currency_code, settings.currency_minor_unit,
        JSON.stringify(data.earnings), JSON.stringify(data.deductions), sum.gross, sum.deductionTotal, sum.net, data.note]);
      await audit(db, req.actor, 'salary-slips', 'SALARY_DRAFT_CREATED', result.rows[0].id);
      return salarySlip(db, result.rows[0].id, req.actor);
    }, req.actor);
    send(res, row, 201);
  });
  router.get('/:id', async (req, res) => send(res, await salarySlip(pool, id(req), req.actor)));
  router.patch('/:id', role('CEO'), async (req, res) => {
    const slipId = id(req);
    const data = parse(object({ version, ...Object.fromEntries(Object.entries(financials).map(([k, v]) => [k, v.optional()])) }), req.body);
    const row = await transaction(pool, async db => {
      const current = await salarySlip(db, slipId, req.actor);
      checkVersion(current, data.version);
      if (current.state !== 'DRAFT') fail(409, 'SALARY_IMMUTABLE', 'Published and voided statements cannot be edited');
      const earnings = data.earnings ?? current.earnings;
      const deductions = data.deductions ?? current.deductions;
      const sum = totals(earnings, deductions);
      await db.query(`UPDATE salary_slips SET earnings=$2,deductions=$3,gross=$4,deduction_total=$5,net=$6,note=$7,
        version=version+1,updated_at=now() WHERE id=$1`,
      [slipId, JSON.stringify(earnings), JSON.stringify(deductions), sum.gross, sum.deductionTotal, sum.net, data.note ?? current.note]);
      await audit(db, req.actor, 'salary-slips', 'SALARY_DRAFT_UPDATED', slipId);
      return salarySlip(db, slipId, req.actor);
    }, req.actor);
    send(res, row);
  });
  router.post('/:id/publish', role('CEO'), async (req, res) => {
    const slipId = id(req);
    const data = parse(object({ version }), req.body);
    const row = await transaction(pool, async db => {
      const current = await salarySlip(db, slipId, req.actor);
      checkVersion(current, data.version);
      if (current.state !== 'DRAFT') fail(409, 'INVALID_STATE', 'Only drafts can be published');
      const settings = await company(db);
      if (!settings.salary_publication_enabled || !settings.legal_name || !settings.statement_address || !settings.salary_jurisdiction) {
        fail(409, 'PUBLICATION_NOT_READY', 'Company metadata and jurisdiction review must be configured before publication');
      }
      const existing = await db.query("SELECT 1 FROM salary_slips WHERE employee_id=$1 AND period=$2 AND state='PUBLISHED'", [current.employee_id, current.period]);
      if (existing.rowCount) fail(409, 'SALARY_ALREADY_PUBLISHED', 'Void the existing current statement before publishing its replacement');
      const snapshot = await snapshots(db, current.employee_id);
      await db.query(`UPDATE salary_slips SET state='PUBLISHED',employee_snapshot=$2,company_snapshot=$3,published_at=now(),
        published_by_user_id=$4,version=version+1,updated_at=now() WHERE id=$1`, [slipId, snapshot.employee, snapshot.company, req.actor.id]);
      await audit(db, req.actor, 'salary-slips', 'SALARY_PUBLISHED', slipId);
      return salarySlip(db, slipId, req.actor);
    }, req.actor);
    send(res, row);
  });
  router.post('/:id/void', role('CEO'), async (req, res) => {
    const slipId = id(req);
    const data = parse(object({ version, reason }), req.body);
    const row = await transaction(pool, async db => {
      const current = await salarySlip(db, slipId, req.actor);
      checkVersion(current, data.version);
      if (current.state !== 'PUBLISHED') fail(409, 'INVALID_STATE', 'Only published statements can be voided');
      await db.query(`UPDATE salary_slips SET state='VOIDED',void_reason=$2,voided_at=now(),voided_by_user_id=$3,
        version=version+1,updated_at=now() WHERE id=$1`, [slipId, data.reason, req.actor.id]);
      await audit(db, req.actor, 'salary-slips', 'SALARY_VOIDED', slipId, data.reason);
      return salarySlip(db, slipId, req.actor);
    }, req.actor);
    send(res, row);
  });
  router.get('/:id/pdf', async (req, res) => {
    parse(object({}), req.query);
    await rateLimit(pool, config, req, res, 'pdf', 20, 60, req.actor.id);
    const slipId = id(req);
    const { row, pdf } = await transaction(pool, async db => {
      const row = await salarySlip(db, slipId, req.actor);
      const snapshot = row.state === 'DRAFT' ? await snapshots(db, row.employee_id) : { employee: row.employee_snapshot, company: row.company_snapshot };
      return { row, pdf: await statementPdf(row, snapshot, config.pdfFont) };
    }, req.actor);
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="salary-${row.period}-r${row.revision}-${row.id}.pdf"`);
    res.send(pdf);
  });
  return router;
}
