const { Client } = require('pg');

const url = process.env.NEON_DB_URL;

if (!url) {
  throw new Error('NEON_DB_URL not set');
}

const host = new URL(url).hostname;

if (!host.endsWith('.neon.tech') && host !== 'neon.tech') {
  throw new Error('Invalid DB provider: ' + host);
}

const client = new Client({
  connectionString: url,
  ssl: true
});

async function run() {
  await client.connect();

  const tables = await client.query(
    "SELECT table_schema, table_name " +
    "FROM information_schema.tables " +
    "WHERE table_schema NOT IN ('pg_catalog', 'information_schema') " +
    "ORDER BY table_schema, table_name;"
  );

  console.log('=== TABLES IN NEON ===');
  console.table(tables.rows);

  const extensions = await client.query(
    "SELECT extname FROM pg_extension;"
  );

  console.log('=== EXTENSIONS ===');
  console.table(extensions.rows);

  await client.end();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});