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

  // 2. insert with valid UUID
  const id = crypto.randomUUID();

  await client.query("INSERT INTO validation.proofs (id, user_id, file_url, created_at) VALUES ($1, $2, $3, NOW())", [id, userId, 'test-url'])

  console.log('WRITE OK')

  await client.end();
})();