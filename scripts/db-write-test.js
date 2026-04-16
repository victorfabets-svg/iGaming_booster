const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.NEON_DB_URL,
  ssl: true,
});

async function run() {
  console.log('Connecting...');
  await client.connect();
  console.log('Connected.');

  // Fetch real user for FK validation
  const userRes = await client.query(
    "SELECT id FROM identity.users LIMIT 1"
  );

  if (userRes.rows.length === 0) {
    throw new Error('No users found in identity.users');
  }

  const userId = userRes.rows[0].id;
  console.log('Using user_id:', userId);

  const insertQuery = `
    INSERT INTO validation.proofs (id, user_id, file_url, hash)
    VALUES (
      gen_random_uuid(),
      '${userId}',
      'test-url',
      'test-hash'
    )
    RETURNING *;
  `;

  console.log('Running INSERT...');
  const insertRes = await client.query(insertQuery);
  console.table(insertRes.rows);

  console.log('Running SELECT...');
  const selectRes = await client.query(
    "SELECT * FROM validation.proofs WHERE file_url = 'test-url'"
  );
  console.table(selectRes.rows);

  await client.end();
  console.log('Done.');
}

run().catch(err => {
  console.error('DB WRITE TEST ERROR');
  console.error(err.message);
  console.error(err.stack);
  process.exit(1);
});