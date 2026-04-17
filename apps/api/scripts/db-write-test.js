const crypto = require('crypto');
const { Client } = require('pg');

(async () => {
  const client = new Client({
    connectionString: process.env.NEON_DB_URL,
    ssl: true
  });

  await client.connect();

  console.log('Connected to Neon');

  // 1. get real user
  const userRes = await client.query('SELECT id FROM identity.users LIMIT 1');
  if (userRes.rows.length === 0) {
    throw new Error('No users found for FK');
  }

  const userId = userRes.rows[0].id;

  // 2. discover real schema
  const columns = await client.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_schema = 'validation' 
    AND table_name = 'proofs'
  `);
  console.log('COLUMNS:', columns.rows);

  // 3. insert with valid UUID using only existing columns
  const id = crypto.randomUUID();
  const hash = crypto.randomUUID();

  await client.query(
    "INSERT INTO validation.proofs (id, user_id, file_url, hash) VALUES ($1, $2, $3, $4)",
    [id, userId, 'test-url', hash]
  );

  console.log('WRITE OK')

  await client.end();
})();