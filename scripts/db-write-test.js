const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.NEON_DB_URL,
  ssl: true,
});

async function run() {
  console.log('Connecting...');
  await client.connect();
  console.log('Connected.');

  const insertQuery = `
    INSERT INTO validation.proofs (id, user_id, file_url, hash)
    VALUES (gen_random_uuid(), 'test-user-ci', 'test-url', 'test-hash')
    RETURNING *;
  `;

  console.log('Running INSERT...');
  const insertRes = await client.query(insertQuery);
  console.table(insertRes.rows);

  console.log('Running SELECT...');
  const selectRes = await client.query(
    "SELECT * FROM validation.proofs WHERE user_id = 'test-user-ci'"
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