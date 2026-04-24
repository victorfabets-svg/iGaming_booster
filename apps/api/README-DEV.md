# Development Setup — API & QA Pipeline

This document describes how to run the backend in a local development environment so the frontend Sprint 6 QA flow can be exercised end-to-end.

---

## Pre-requisites

- **Node.js 18+** (for `ts-node`)
- **PostgreSQL 14+** (local or container; the API connects via `NEON_DB_URL` environment variable, so any compatible Postgres works, including a local one via Docker)
- No external services required: storage uses in-memory mock when `R2_*` env vars are absent, and the pipeline runs locally via `ts-node`

---

## Subir o Stack (no codespace limpo)

### 1. Criar arquivo `.env` na raiz do projeto

```bash
cat >> .env << 'EOF'
NODE_ENV=development
PORT=3000

# Database — substitua pelo seu Postgres local ou connection string do Neon
# Exemplo local Docker:
NEON_DB_URL=postgresql://postgres:postgres@localhost:5432/igaming_booster

# JWT secret para desenvolvimento (NÃO usar em produção)
JWT_SECRET=dev-secret-do-not-use-in-production-32chars
EOF
```

Se preferir Postgres via Docker:

```bash
docker run -d \
  --name igaming-postgres \
  -e POSTGRES_DB=igaming_booster \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  postgres:15-alpine
```

### 2. Rodar migrations (cria todos os schemas: `identity`, `validation`, `events`, `audit`, `rewards`, `raffles`, `fraud`, `payments`)

```bash
npm run migrate
```

> Scripts `migrate` lives in `package.json` root → `cd apps/api && ts-node src/scripts/run-migrations.ts`

### 3. Subir a API

```bash
npm run dev
```

Verificação:

```bash
curl -sf http://localhost:3000/health/db
# → {"status":"ok",...}
```

---

## Mintar JWT de Dev

O script `scripts/mint-dev-token.ts` assina um JWT com o mesmo secret da API.

### Via CLI (recomendado)

```bash
# Mintar token para um email (cria user se não existir)
JWT=$(cd apps/api && npx ts-node scripts/mint-dev-token.ts --email=qa@example.com --silent)
echo "VITE_DEV_JWT=$JWT"
```

```bash
# Mintar token para um user_id explícito
JWT=$(cd apps/api && npx ts-node scripts/mint-dev-token.ts --user-id=a1b2c3d4-... --silent)
echo "VITE_DEV_JWT=$JWT"
```

### Via endpoint (alternativa)

```bash
# POST /dev/token — só exposto quando NODE_ENV=development
curl -s -X POST http://localhost:3000/dev/token \
  -H "Content-Type: application/json" \
  -d '{"email": "qa@example.com"}' \
  | jq -r '.token'
```

### Copiar para o frontend

```bash
echo "VITE_DEV_JWT=$(cd apps/api && npx ts-node scripts/mint-dev-token.ts --email=qa@example.com --silent)" >> apps/web/.env
```

---

## Exercitar Cada Status Terminal

O fluxo completo depende de 3 workers assíncronos (fraud, payments, validation-aggregator) rodando via polling. Para QA visual, use o endpoint de fixture `POST /dev/proofs/force-status` para pular a pipeline e definir o status diretamente no banco.

### Fluxo Completo (lento, ~15-25s end-to-end)

```bash
# 1. Submeter um proof (retorna proof_id)
curl -s -X POST http://localhost:3000/proofs \
  -H "Authorization: Bearer $JWT" \
  -F "file=@/caminho/para/arquivo.png"

# 2. Aguardar (~15-25s) os consumers processarem os eventos
# Polling intervals: proof_submitted(5s), fraud_check(5s), payment_identifier(5s), aggregator(2s)

# 3. Verificar status
curl -s http://localhost:3000/proofs/{proof_id} \
  -H "Authorization: Bearer $JWT"
# → {"proof_id":"...","status":"approved|rejected|manual_review","confidence_score":0.95}
```

### Via Fixture (instantâneo — recomendado para QA)

O endpoint `/dev/proofs/force-status` escreve direto em `validation.proof_validations`, pulando toda a pipeline assíncrona.

```bash
# approved
curl -s -X POST http://localhost:3000/dev/proofs/force-status \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"proof_id": "ID_DO_SEU_PROOF", "status": "approved", "confidence_score": 0.95}'

# rejected
curl -s -X POST http://localhost:3000/dev/proofs/force-status \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"proof_id": "ID_DO_SEU_PROOF", "status": "rejected", "confidence_score": 0.15}'

# manual_review
curl -s -X POST http://localhost:3000/dev/proofs/force-status \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"proof_id": "ID_DO_SEU_PROOF", "status": "manual_review", "confidence_score": 0.65}'
```

### Resumo Rápido (copy-paste)

```bash
# ---------- Setup ----------
export JWT_SECRET=dev-secret-do-not-use-in-production-32chars
export NEON_DB_URL=postgresql://postgres:postgres@localhost:5432/igaming_booster
npm run migrate
npm run dev &
sleep 3

# ---------- Mintar JWT ----------
JWT=$(cd apps/api && npx ts-node scripts/mint-dev-token.ts --email=qa@example.com --silent)
echo "JWT=$JWT"

# ---------- Submeter proof ----------
PROOF_RESP=$(curl -s -X POST http://localhost:3000/proofs \
  -H "Authorization: Bearer $JWT" \
  -F "file=@/tmp/test-proof.png")
PROOF_ID=$(echo $PROOF_RESP | jq -r '.proof_id')
echo "proof_id=$PROOF_ID"

# ---------- Exercitar cada status ----------
curl -s -X POST http://localhost:3000/dev/proofs/force-status \
  -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
  -d "{\"proof_id\": \"$PROOF_ID\", \"status\": \"approved\", \"confidence_score\": 0.95}"
# front-end deve mostrar tela Approved

curl -s -X POST http://localhost:3000/dev/proofs/force-status \
  -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
  -d "{\"proof_id\": \"$PROOF_ID\", \"status\": \"rejected\", \"confidence_score\": 0.10}"
# front-end deve mostrar tela Rejected

curl -s -X POST http://localhost:3000/dev/proofs/force-status \
  -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
  -d "{\"proof_id\": \"$PROOF_ID\", \"status\": \"manual_review\", \"confidence_score\": 0.65}"
# front-end deve mostrar tela ManualReview
```

---

## Seed de QA (opcional)

Cria `qa@example.com` com UUID fixo e um proof pré-carregado em cada status.

```bash
npm run seed:qa
```

Isso executa `scripts/seed-qa.ts` e imprime os tokens e proof_ids prontos para o `.env` do frontend.

---

## Arquitetura da Pipeline (para contexto)

```
POST /proofs
  → validation.proofs + events.proof_submitted (transactional outbox)

Worker (apps/worker):
  proof_submitted.consumer (5s poll)
    → validation_started (cria validation.proof_validations com status='processing')
    → fraud_check_requested
    → payment_identifier_requested

  fraud_check.consumer (5s poll)
    → fraud_scored (score: 0.0-1.0)

  payment_identifier.consumer (5s poll)
    → payment_identifier_extracted

  validation_aggregator.consumer (2s poll)
    → correlaciona fraud_scored + payment_identifier_extracted
    → final_score = fraud_score + payment_modifier
      final_score >= 0.9 → approved
      final_score >= 0.6 → manual_review
      else → rejected
    → validation.proof_validations.status = approved|rejected|manual_review
    → proof_validated / proof_rejected events
```

Para QA visual, o worker **pode não ser necessário** se usar o endpoint `/dev/proofs/force-status`. O worker só é necessário para o fluxo completo (lento).

---

## Variáveis de Ambiente de Dev

| Variável | Default | Descrição |
|---|---|---|
| `NODE_ENV` | `development` | Ativa rotas `/dev/*` |
| `PORT` | `3000` | Porta da API |
| `NEON_DB_URL` | (required) | Connection string do Postgres |
| `JWT_SECRET` | (required) | Secret para assinatura JWT. Default dev: `dev-secret-do-not-use-in-production-32chars` |
| `VALIDATION_APPROVAL_THRESHOLD` | `0.9` | Score mínimo para approved |
| `VALIDATION_MANUAL_REVIEW_THRESHOLD` | `0.6` | Score mínimo para manual_review |
| `R2_*` | — | Opcional. Se ausente, storage usa mock in-memory |