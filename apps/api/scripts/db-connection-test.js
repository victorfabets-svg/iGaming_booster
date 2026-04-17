const { Client } = require('pg');
const client = new Client({
  connectionString: process.env.NEON_DB_URL,
  ssl: true
});
client.connect()
  .then(() => { console.log('DB Connected'); return client.query('SELECT 1'); })
  .then(() => { console.log('Query OK'); client.end(); })
  .catch(err => { console.error(err); process.exit(1); });