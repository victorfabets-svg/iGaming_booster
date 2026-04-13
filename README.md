# iGaming_booster

## Deployment

This project is deployed via **Vercel** only.

### Cloudflare Workers Integration Removed

The Cloudflare Workers integration was removed because:
- The project is a Node.js Fastify API
- Cloudflare Workers requires a different runtime model (serverless edge functions)
- The external integration was causing failing builds in the CI check

### Tech Stack

- **Runtime**: Node.js 20+
- **API Framework**: Fastify
- **Database**: PostgreSQL (via pg with Neon)
- **Storage**: Cloudflare R2 (S3-compatible API)
- **Deployment**: Vercel