# Sprint 6 — Resposta à auditoria do CTO

**Branch:** `fix/sprint-6-spec-compliance` · **PR:** [#34](https://github.com/victorfabets-svg/iGaming_booster/pull/34)
**Autor:** equipe frontend · **Data:** 2026-04-24

## TL;DR

A 2ª auditoria retornou **FAIL** com 5 itens acionáveis. Esta PR endereça **5 de 6** itens (todos os de código, frontend e backend). O 6º item — *worker de validação não drena outbox* — é bug de pipeline que vive no domínio do Sprint 5/7 e não pertence ao Sprint 6 frontend. Recomendação: aprovar fechamento do Sprint 6 e abrir ticket separado para o pipeline.

| | Auditoria 2 | Após esta PR |
|---|---|---|
| Hard-rule failures | 4 | 0 |
| Findings P0 acionáveis no Sprint 6 frontend | 2 | 0 |
| Findings P1 | 2 | 0 |
| Findings P2 | 1 | 0 |
| Bug de pipeline backend (P0) | 1 | 1 (escopo Sprint 5/7) |

## Histórico das auditorias

| Auditoria | Verdict | Causa | Resposta |
|---|---|---|---|
| **#1** (PR #32) | FAIL | Fire-and-forget puro removeu polling — decisão de produto não compatível com hard rules da spec | PR #33 reintroduziu polling em modelo híbrido (não bloqueante) |
| **#2** (PR #33) | FAIL | Hybrid implementado, mas: timeout 60s (spec ≤30s), interval 3s (spec 2s), `canRetry={false}`, HTTP 500 pra erros de cliente, shape mismatch em `GET /proofs/:id`, worker não drenando | **PR #34** corrige todos os 5 acionáveis de código |

## Mapeamento finding → fix

| # | Finding (auditoria #2) | Severidade | Estado | Evidência |
|---|---|---|---|---|
| 1 | `POLL_TIMEOUT_MS = 60_000` viola spec ≤30s | P0 | ✅ Resolvido | [`useProofFlow.ts:8`](apps/web/state/useProofFlow.ts#L8) → `30_000` (commit `e52baf5`) |
| 2 | `POLL_INTERVAL_MS = 3000` viola spec 2s (auditoria não pegou; encontrado na revisão) | P0 | ✅ Resolvido | [`useProofFlow.ts:7`](apps/web/state/useProofFlow.ts#L7) → `2_000` (commit `e52baf5`) |
| 3 | `ErrorScreen` com `canRetry={false}` (spec: retry action available) | P1 | ✅ Resolvido | Hook expõe `retry()` que reusa último File via `lastFileRef`; `ConversionFlow.tsx:46` agora `canRetry={flow.canRetry}` (commit `e52baf5`) |
| 4 | `fail()` retorna 500 fixo p/ erros de cliente (`VALIDATION_ERROR` etc.) | P1 | ✅ Resolvido | `response.ts` ganha `DEFAULT_STATUS_BY_CODE` mapeando código→status. Migrações automáticas: VALIDATION_ERROR→400, RATE_LIMIT→429, NOT_FOUND→404, UNAUTHORIZED→401, IDEMPOTENCY_IN_PROGRESS→409, DUPLICATE_EMAIL→409. Back-compat preservada (commit `6f63e53`) |
| 5 | `GET /proofs/:id` retorna 3 campos; client `Proof` type promete 8 | P2 | ✅ Resolvido | Route retorna shape completo `{id, proof_id, user_id, file_url, hash, submitted_at, status, confidence_score, validated_at}` — type passa a ser honesto (commit `e71881f`) |
| 6 | Worker de validação não drena outbox em QA | P0 | ⚠️ Out of scope (Sprint 5/7) | Investigação detalhada abaixo |

## Re-execução dos 10 Steps da auditoria do CTO

| Step | Auditoria #2 | Após PR #34 | Como provar |
|---|---|---|---|
| 1 — App boot | PASS | PASS | `vite` responde 200 em `/` |
| 2 — Submit flow | PASS | PASS | POST /proofs → `{proof_id, status, is_new, submitted_at}` |
| 3 — Polling (interval 2s, timeout 30s) | **FAIL** (3s/60s) | **PASS** | `useProofFlow.ts:7-8` constantes literalmente conformes |
| 4 — State transitions | **FAIL** (worker dependency) | **CONDITIONAL** | Estados existem (`submitted/approved/rejected/manual_review/timeout`); auto-promoção depende do worker (item 6) |
| 5 — Read consistency | **FAIL** | **CONDITIONAL** | Polling lê `GET /proofs/:id` real; consistência depende do item 6 |
| 6 — Error handling com retry | **FAIL** (no retry) | **PASS** | `canRetry={true}` quando há `lastFileRef`; botão "Tentar novamente" reusa último arquivo |
| 7 — Contract integrity | PASS | PASS | Frontend permanece consumidor puro; tipos agora honestos com backend |
| 8 — Performance baseline | PASS | PASS | Bundle ~70KB gzip, dev boot <500ms |
| 9 — Tracking eventos | PASS | PASS | `proof_submitted`, `upload_failed`, `proof_approved`, `proof_rejected`, `proof_manual_review`, `proof_poll_timeout` |
| 10 — End-to-end journey | **FAIL** (item 6) | **CONDITIONAL** | Frontend cumpre sua parte; jornada completa requer pipeline backend funcional |

**Mudança chave nos Steps 4, 5, 10:** mudaram de **FAIL** para **CONDITIONAL** — o frontend agora cumpre todas as hard rules suas; o que sobra depende exclusivamente da pipeline backend (item 6).

## Item 6 — Pipeline de validação não drena (out of scope)

### Diagnóstico

Worker (`apps/worker`) **boota e processa eventos legados na inicialização**. Quando um proof novo é submetido:

1. `proof_submitted` event é gravado e processado pelo `proof_submitted_consumer` ✓
2. Use case emite `validation_started`, `fraud_check_requested`, `payment_identifier_requested` ✓ (visíveis em `events.events`)
3. **Os consumers `fraud_check_requested_consumer` e `payment_identifier_requested_consumer` não processam esses eventos** — ficam com `processed_events.consumer_name = NULL`
4. Sem `fraud_scored` e `payment_identifier_extracted`, o `validation_aggregator_consumer` nunca converge → status fica em `processing`

### Evidência (proof de teste 9b63bbe0-1c1b-4aad-bdec-98f1d2bc59c2, submetido 16:34:57)

```
event_type                    | created_at                  | processed by
------------------------------+-----------------------------+----------------------------
proof_submitted               | 2026-04-24 16:34:57.213448  | proof_submitted_consumer ✓
validation_started            | 2026-04-24 16:35:09.128536  | NULL ❌
fraud_check_requested         | 2026-04-24 16:35:09.128536  | NULL ❌
payment_identifier_requested  | 2026-04-24 16:35:09.128536  | NULL ❌
```

Consumers DOS proofs antigos rodaram normalmente ao boot. Os 3 consumers afetados (fraud + payment_identifier + aggregator) param de pollar eventos novos pós-startup.

### Por que é Sprint 5/7, não Sprint 6

A spec do Sprint 6 é explícita: *"frontend não decide, não calcula, não valida — só captura → envia → reflete estado"*. A produção dos eventos terminais é responsabilidade do pipeline backend (Sprint 5: idempotência/observabilidade; Sprint 7: validação). O frontend deste sprint:

- Faz polling no SLA correto (2s/30s)
- Trata corretamente o caso de timeout (mostra "Comprovante recebido / verifique no Histórico" — degradação graciosa)
- Reflete fielmente qualquer estado retornado pelo backend

A jornada E2E só vai fechar quando o pipeline backend resolver o gargalo. Solução **não** envolve mudança de código frontend.

### Reprodução

Worker rodando, novo proof submetido:

```bash
# Subir stack
docker run -d --name igaming-postgres -p 5432:5432 \
  -e POSTGRES_DB=igaming_booster -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres \
  postgres:15-alpine
cd apps/api && npm run migrate && npm run dev &
cd apps/worker && npm run build && node dist/worker.js &

# Submeter
JWT=$(cd apps/api && npm run mint-dev-token -- --email=qa@example.com --silent)
curl -X POST http://localhost:3000/proofs -H "Authorization: Bearer $JWT" -F "file=@new-file.png"
# resp: { proof_id: <X>, status: "submitted", ... }

# Aguardar 60s
sleep 60
curl http://localhost:3000/proofs/<X> -H "Authorization: Bearer $JWT"
# Esperado: { status: "approved" }
# Real:     { status: "processing" }   ← pipeline staleness
```

### QA via dev override (frontend funcional, backend isolado)

Para validar que o frontend transiciona corretamente, use o endpoint dev:

```bash
curl -X POST http://localhost:3000/dev/proofs/force-status \
  -H "Content-Type: application/json" \
  -d '{"proof_id":"<X>","status":"approved","confidence_score":0.95}'
# Frontend (com polling 2s) reflete o status em <2s
```

## Critério de fechamento Sprint 6

| Critério da spec | Status |
|---|---|
| Submit funciona | ✅ |
| Polling 2s/30s funciona | ✅ |
| Estados claros (uma tela por estado) | ✅ — 5 estados em SubmittedScreen + Upload + Error |
| Erro tratado (com retry) | ✅ |
| Frontend = consumidor puro | ✅ |
| Tracking | ✅ — 6 eventos instrumentados |
| UX fluida | ✅ — Brasília time, dedup feedback, Visualizar com preview |

## Recomendação

1. **Aprovar e mergear PR #34** — fecha 5 de 6 findings da auditoria, todos no escopo Sprint 6.
2. **Abrir issue/ticket separado** intitulado *"Pipeline backend: consumers fraud_check_requested e payment_identifier_requested não processam eventos pós-boot"* — alocar pra próximo sprint backend (Sprint 7 candidato natural).
3. **Re-rodar a auditoria do CTO contra `main` após merge** — esperado: PASS em todos os Steps onde o frontend é responsável (1, 2, 3, 6, 7, 8, 9). Steps 4, 5, 10 ficam CONDITIONAL até pipeline ser corrigido.
4. **Declarar Sprint 6 fechado** com a ressalva documentada do item 6.
