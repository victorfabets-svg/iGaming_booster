const { Client } = require('pg');

(async () => {
  const client = new Client({
    connectionString: process.env.NEON_DB_URL,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  await client.query('SELECT 1');

  console.log('runtime ok');
  await client.end();
})();