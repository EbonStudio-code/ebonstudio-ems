import pg from 'pg';

// DATE represents a company-local calendar date, never a JavaScript timestamp.
pg.types.setTypeParser(1082, value => value);
pg.types.setTypeParser(1182, pg.types.getTypeParser(1009));
const poolOptions = {
  connectionTimeoutMillis: 5000,
  max: 10,
  idleTimeoutMillis: 30000,
  statement_timeout: 15000,
};

const pool = new pg.Pool(poolOptions);

pool.on('error', () => {
  console.error('An idle PostgreSQL connection failed.');
});

export { pool };
