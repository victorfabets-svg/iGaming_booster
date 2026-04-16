import { buildApp } from './app';
import { config } from '../shared/config/env';

async function start() {
  const app = buildApp();

  const port = config.apiPort;

  try {
    await app.listen({ port });
    console.log(`Server running on port ${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start().catch(err => {
  console.error(err);
  process.exit(1);
});