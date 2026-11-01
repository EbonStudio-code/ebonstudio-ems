import { Router } from 'express';
import { z, object, text, optionalText, date, uuid, version, reason, parse, id, send, pageQuery, list } from '../../core/validation.js';
import { role } from '../identity/session.js';
import { transaction, audit } from '../../core/transactions.js';
import { advanceCalendar } from '../company/service.js';
import { fail } from '../../core/errors.js';
import { holidayPreview } from './service.js';

const proposalFields = { date: date.optional(), name: text().optional(), note: optionalText(500).optional() };
const acknowledgement = { impactFingerprint: z.string().regex(/^[a-f0-9]{64}$/), acknowledgeImpact: z.literal(true) };
export function holidayRoutes({ pool }) {
  const router = Router();
  router.get('/', async (req, res) => {
    const q = pageQuery(req, { from: date.optional(), to: date.optional(), year: z.coerce.number().int().min(1900).max(9999).optional() });
    res.json(await list(pool, `SELECT id,date,name,note,version FROM holidays WHERE ($1::date IS NULL OR date>=$1)
      AND ($2::date IS NULL OR date<=$2) AND ($3::int IS NULL OR extract(year FROM date)=$3) ORDER BY date,id`,
    [q.from || null, q.to || null, q.year || null], q));
  });
  router.use(role('CEO'));
  router.post('/impact-preview', async (req, res) => {
    const proposal = parse(object({ ...proposalFields, operation: z.enum(['CREATE','UPDATE','DELETE']),
      holidayId: uuid.optional(), version: version.optional() }), req.body);
    send(res, await transaction(pool, db => holidayPreview(db, proposal), req.actor));
  });
  for (const [method, path, operation] of [['post','/','CREATE'], ['patch','/:id','UPDATE'], ['delete','/:id','DELETE']]) {
    router[method](path, async (req, res) => {
      const holidayId = operation === 'CREATE' ? undefined : id(req);
      const schema = operation === 'CREATE'
        ? object({ date, name: text(), note: optionalText(500).default(''), ...acknowledgement })
        : object({ ...(operation === 'UPDATE' ? proposalFields : {}), version, reason, ...acknowledgement });
      const data = parse(schema, req.body);
      const row = await transaction(pool, async db => {
        const proposal = { operation, holidayId, version: data.version };
        for (const key of ['date','name','note']) if (data[key] !== undefined) proposal[key] = data[key];
        const preview = await holidayPreview(db, proposal);
        if (preview.impactFingerprint !== data.impactFingerprint) fail(409, 'CALENDAR_CHANGED', 'Calendar or leave changed. Review a fresh impact preview.');
        let result;
        if (operation === 'CREATE') {
          result = await db.query('INSERT INTO holidays(date,name,note) VALUES($1,$2,$3) RETURNING id,date,name,note,version',
            [preview.proposed.date, preview.proposed.name, preview.proposed.note]);
        } else if (operation === 'UPDATE') {
          result = await db.query('UPDATE holidays SET date=$2,name=$3,note=$4,version=version+1,updated_at=now() WHERE id=$1 RETURNING id,date,name,note,version',
            [holidayId, preview.proposed.date, preview.proposed.name, preview.proposed.note]);
        } else {
          await db.query('DELETE FROM holidays WHERE id=$1', [holidayId]);
        }
        await advanceCalendar(db, true);
        await audit(db, req.actor, 'holidays', 'HOLIDAY_' + operation, holidayId || result.rows[0].id, data.reason || null);
        return result?.rows[0];
      }, req.actor);
      if (operation === 'DELETE') res.status(204).end();
      else send(res, row, operation === 'CREATE' ? 201 : 200);
    });
  }
  return router;
}
