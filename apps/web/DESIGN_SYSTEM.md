# Design System — Dashboard Web

> **Fonte de verdade visual** para `apps/web`. Este documento é gerado a partir da implementação real (`apps/web/styles/global.css` + `apps/web/pages/index.tsx` + `apps/web/components/*`). Qualquer nova tela/componente DEVE seguir estritamente os tokens, padrões e variantes aqui documentados para preservar a identidade visual do produto.

- **Arquivo de tokens (CSS):** `apps/web/styles/global.css`
- **Entrada principal (index):** `apps/web/pages/index.tsx`
- **Biblioteca de componentes:** `apps/web/components/`

---

## 1. Princípios

1. **Paleta de 3 cores.** Toda a UI nasce de três cores: **Grafite profundo** (`#0F1115` dark) / **Off-white estruturado** (`#F4F6F8` light) como base, **Verde orgânico** (`#2FBF71`) como ação/sucesso, **Ouro envelhecido** (`#C6A85B`) como valor/destaque. Qualquer outra cor (erro, info, fraud) é **derivada** dessas três, não inventada.
2. **Dark + Light.** O produto opera em ambos os temas (`data-theme="light"` no `<html>`). O default segue `prefers-color-scheme` do SO; preferência explícita persiste em `localStorage` (`igb_theme`). Tokens semânticos não trocam de papel — só `background`, `text` e `overlays` flipam.
3. **Glassmorphism contido.** Superfícies usam `backdrop-filter: blur()` com bordas sutis (`--glass-border`) e leves highlights (`--surface-overlay-medium`). Os overlays se invertem no light (preto translúcido em vez de branco). Não abusar de transparências em áreas de leitura densa.
4. **Tipografia bicéfala.** `Syne` para display/headings (impacto), `Plus Jakarta Sans` para corpo/UI (legibilidade). `JetBrains Mono` para IDs/códigos/timestamps.
5. **Cor como semântica.** Verde = sucesso/CTA primário, Ouro = valor/warning, Terra (`#BF553B`) = erro, Ouro queimado (`#8C6F2A`) = fraude/revisão, Azul-frio (`#6B8FA6`) = info. Não usar cor por estética fora destes papéis.
6. **Movimento suave.** Easing padrão `cubic-bezier(0.4, 0, 0.2, 1)` para layout e `cubic-bezier(0.16, 1, 0.3, 1)` para transições de dados/barras.
7. **Escala fixa.** Spacing, radius, tipografia e shadows só podem usar tokens — nunca valores mágicos.

---

## 2. Tokens de Cor

### 2.1 Marca (constantes em ambos os temas)

| Token | Hex | Papel |
|---|---|---|
| `--color-action` | `#2FBF71` | Verde orgânico — CTAs, success, primary |
| `--color-action-hover` | `#248F55` | Verde escurecido para hover |
| `--color-value` | `#C6A85B` | Ouro envelhecido — valor, recompensa, warning |
| `--color-value-hover` | `#A88B47` | Ouro escurecido para hover |

### 2.2 Background & Surface (varia por tema)

| Token | Dark | Light | Uso |
|---|---|---|---|
| `--color-background-primary` / `--bg-base` | `#0F1115` | `#F4F6F8` | Plano de fundo global |
| `--color-background-secondary` / `--bg-surface-hover` | `#161A21` | `#ECEEF1` | Hover/superfícies elevadas |
| `--color-background-tertiary` | `#1D222B` | `#E2E5EA` | Modais, drilldowns |
| `--color-surface-primary` / `--bg-surface` | `#181D25` | `#FFFFFF` | Cards, selectors, filter-bar |
| `--color-border-subtle` / `--glass-border` | `#262C36` | `#D8DCE2` | Bordas padrão |
| `--surface-overlay-soft` | `rgba(255,255,255,0.02)` | `rgba(15,17,21,0.03)` | Hover quase imperceptível |
| `--surface-overlay-medium` / `--glass-highlight` | `rgba(255,255,255,0.05)` | `rgba(15,17,21,0.05)` | Hover padrão de glass |
| `--surface-overlay-strong` | `rgba(255,255,255,0.10)` | `rgba(15,17,21,0.08)` | Bordas de glass mais visíveis |
| `--modal-overlay` | `rgba(0,0,0,0.6)` | `rgba(15,17,21,0.45)` | Backdrop de modal |

### 2.3 Texto (varia por tema)

| Token | Dark | Light | Uso |
|---|---|---|---|
| `--color-text-primary` | `#E8ECF1` | `#0F1115` | Títulos, KPIs, valores |
| `--color-text-secondary` | `#A4ADBA` | `#4A5160` | Labels, descrições, metadados |
| `--color-text-muted` | `#6F7787` | `#6F7787` | Placeholders, textos auxiliares |
| `--color-on-primary` | `#0F1115` | `#0F1115` | Texto sobre superfícies action/value (sempre grafite — passa AA em verde e ouro) |

### 2.4 Semântica (cada papel tem `primary`, `secondary` e `glow` translúcida)

Todos derivados do par verde/ouro ou de complementos harmônicos. As cores **primary** são constantes em ambos os temas; só os **glows** afinam de opacidade no light pra não saturar fundos brancos.

| Papel | Primary | Secondary | Glow (dark) | Glow (light) |
|---|---|---|---|---|
| Success | `#2FBF71` (`--color-action`) | `#248F55` | `rgba(47,191,113,0.15)` | `rgba(47,191,113,0.12)` |
| Primary | `#2FBF71` (`--color-action`) | `#248F55` | `rgba(47,191,113,0.15)` | `rgba(47,191,113,0.12)` |
| Warning | `#C6A85B` (`--color-value`) | `#A88B47` | `rgba(198,168,91,0.15)` | `rgba(198,168,91,0.16)` |
| Anomaly | `#C6A85B` | — | — | — |
| Error | `#BF553B` (terra, complemento harmônico do verde) | `#8F3F2C` | `rgba(191,85,59,0.15)` | `rgba(191,85,59,0.10)` |
| Fraud | `#8C6F2A` (ouro queimado, variação do valor) | `#B59650` | `rgba(140,111,42,0.18)` | `rgba(140,111,42,0.12)` |
| Info | `#6B8FA6` (azul-frio, derivado do grafite) | — | — | — |

### 2.5 Paleta de gráficos (sequencial)

Use **nesta ordem** em séries múltiplas: `--color-action` · `--color-value` · `--color-info-primary` · `--color-error-primary` · `--color-fraud-primary`.

> **Regra:** nunca introduza hex hard-coded em componentes ou inline styles. Toda cor deve resolver para um token. Exceção documentada: `background: #fff` no `<iframe>` de preview de PDF em `HistoricoSection.tsx` — necessário porque PDFs renderizam transparentes e ficariam ilegíveis em fundo escuro.

---

## 3. Tipografia

### 3.1 Famílias

- **Display:** `Syne`, pesos 400/500/600/700/800 — aplicado automaticamente em `h1–h4`, `.card-title`, `.kpi-value`, `.funnel-val`, `.fk-value`.
- **Sistema/UI:** `Plus Jakarta Sans`, pesos 400/500/600/700/800 — default em `body` e `button`.
- **Monoespaçada:** `JetBrains Mono` (classe `.mono`, também fallback `monospace` em `.e-time`) — IDs, timestamps, hashes.

> ⚠️ `JetBrains Mono` é referenciada em CSS mas **não está sendo importada** no `@import` do Google Fonts. Deve ser adicionada: `family=JetBrains+Mono:wght@400;500`.

### 3.2 Escala

| Token | Tamanho | Line-height | Uso |
|---|---|---|---|
| `--text-h1` | 32px | `--lh-heading` (1.2) | Título de página |
| `--text-h2` | 24px | 1.2 | Título de seção |
| `--text-h3` | 18px | 1.2 | Título de card (`.card-title`, uppercase, `letter-spacing: 0.05em`) |
| `--text-body` | 14px | `--lh-body` (1.5) | Texto padrão, labels de tabela, inputs |
| `--text-small` | 12px | 1.5 | Subtextos, timestamps, legendas |

Tamanhos adicionais em uso pontual (não tokenizados, manter apenas dentro dos componentes listados):
- `28px` — `.kpi-value` (valor de KPI, font-display, weight 700).
- `22px` — `.funnel-kpi .fk-value`.
- `11px` — labels de tabela, legendas (`filter-label`, `.fk-label`, `.p-legend-title`, `uppercase` + `letter-spacing 0.04–0.05em`).
- `10px` — `.badge-type` e cabeçalhos de `.table-funnel-agg` (uppercase).

### 3.3 Regras

- `h1..h4` → sempre `Syne`, weight 600.
- Títulos de card (`.card-title`) → **UPPERCASE**, 18px, `letter-spacing: 0.05em`.
- Labels de filtro/tabela → **UPPERCASE**, 11px/12px, `--text-secondary`, `letter-spacing: 0.04–0.05em`.
- Números KPI → `Syne`, weight 700, `--text-primary`.

---

## 4. Espaçamento, Raios e Container

### 4.1 Spacing (`--space-*`)

`1` 4px · `2` 8px · `3` 12px · `4` 16px · `6` 24px · `8` 32px · `12` 48px · `16` 64px.

Padrões observados no index:
- Gap entre cards em `.g-row`: **24px** (`--space-6`).
- Padding interno de `.card`: **24px** (`--space-6`).
- Padding de filtros (`.filter-bar`): **20px 24px**.
- Header global: altura **80px**, `margin-bottom: 32px`.
- Sidebar: margem externa **20px**, padding vertical **32px**.

### 4.2 Radius (`--radius-*`)

`sm` 4px · `md` 8px · `lg` 12px.

- Cards, inputs, botões padrão → `--radius-md` (8px).
- Badges e pills → 8px.
- Modais → 12px (`--radius-lg`).
- Micro (barrinhas, chips): 4–6px.

### 4.3 Container

`--container-max: 1400px` · paddings laterais `--space-6` · `.main-content` desloca por `--sidebar-compact + 40px` (ou `--sidebar-width + 40px` quando expandido).

---

## 5. Elevação, Glass e Blurs

A escala de sombra/blur não é tokenizada hoje. Use **apenas** os presets abaixo:

| Preset | Box-shadow | Backdrop | Onde |
|---|---|---|---|
| **Card** | `0 8px 32px rgba(0,0,0,0.2)` | `blur(16px)` | `.card` |
| **Sidebar** | `0 0 10px var(--color-primary-glow), 0 8px 32px rgba(0,0,0,0.5)` | `blur(30px)` | `.sidebar` |
| **Header** | — | `blur(12px)` sobre `rgba(6,7,9,0.8)` | `.global-header` |
| **Drilldown** | `-10px 0 30px rgba(0,0,0,0.5)` | `blur(20px)` | `.drilldown-overlay` |
| **Hist drilldown** | `-16px 0 48px rgba(0,0,0,0.6)` | `blur(24px)` | `.hist-drilldown` |
| **Modal** | `0 24px 64px rgba(0,0,0,0.6)` | `blur(6px)` no backdrop | `.modal-content` |
| **Toggle sidebar** | `0 4px 10px rgba(0,0,0,0.3)` | — | `.sidebar-toggle` |

> Regra: não invente outras sombras. Se precisar de elevação diferente, estenda este documento **antes** de implementar.

---

## 6. Movimento

- **Easing padrão (layout/interação):** `cubic-bezier(0.4, 0, 0.2, 1)` — sidebar, main-content, nav-item, input focus.
- **Easing de entrada de dados:** `cubic-bezier(0.16, 1, 0.3, 1)` — barras de funil, stacked bar, drilldown de histórico.
- **Durações canônicas:**
  - `0.2s` micro-interações (hover, cor).
  - `0.3s–0.35s` drilldowns e reveals.
  - `0.4s` sidebar expand/collapse e main-content shift.
  - `0.7s` spinner (`btn-spin`).
  - `1s` preenchimento de `score-bar-fill` e `donut-segment`.
  - `1.5s` barras de funil (`.f-bar-fg`, `.bar-segment`).
- **Keyframes definidos:**
  - `fadeIn` — entra seções ativas (`.dashboard-section.active`, 0.4s).
  - `btn-spin` — spinners.

---

## 7. Layout

- **App shell:** `display: flex; min-height: 100vh;` com sidebar fixa + `main-content` fluido.
- **Sidebar:**
  - Compacta: `--sidebar-compact` = **88px**.
  - Expandida: `--sidebar-width` = **280px**.
  - Transição de largura 0.4s cubic-bezier(0.4,0,0.2,1).
  - Borda + glow azul (`--color-primary-glow`) + `backdrop-filter: blur(30px)`.
  - Toggle circular 28px, branco, posicionado `right: -14px; top: 60px`, rotaciona 180° ao expandir.
- **Grid de 12 colunas** (flex com gaps de 24px):
  - `.g-col-12` (100%), `.g-col-8` (≈66%), `.g-col-6` (50%), `.g-col-4` (≈33%), `.g-col-2-4` (20%).
  - Breakpoint único: **`@media (max-width: 1100px)`** → todas as colunas colapsam para 100%.
- **Background:** imagem fixa `/dashboard-bg.png`, opacidade 0.3, `z-index: -1`, `pointer-events: none`.

---

## 8. Componentes

### 8.1 Card (`.card`)

Container base. Fundo `--bg-surface`, borda `--glass-border`, radius 8px, padding 24px, blur 16px, shadow card. Em hover, a borda passa para `--glass-highlight`.
**Slot de título:** `.card-title` (Syne 18px, UPPERCASE, letter-spacing 0.05em, mb-24px).

### 8.2 Botões

Todas as variantes usam radius 8px e `font-weight: 600` salvo indicação.

| Classe | Background | Cor texto | Borda | Uso |
|---|---|---|---|---|
| `.btn` (base) | — | — | none | Wrapper estrutural (10px 20px, gap 8px) |
| `.btn-primary` | `--color-primary-primary` | `#fff` | none | Ação primária; hover → `--color-primary-hover` |
| `.btn-filter-apply` | `--color-primary-primary` | `#fff` | none | Botão "Aplicar" em `.filter-bar`, 8px 20px, `filter: brightness(1.15)` no hover |
| `.action-btn` | transparent | `--text-primary` | `--glass-border` | Ação secundária compacta, UPPERCASE, 12px |
| `.hist-action` | transparent | `--text-primary` | `--glass-border` | Ações em linhas de histórico (6px 12px, gap 6px) |
| `.hist-action-review` | transparent | `#A78BFA` | `rgba(139,92,246,0.4)` | Ação de revisão (roxa) |
| `.funnel-action` | transparent | `--text-secondary` | `--glass-border` | Mini-ação em linha de funil (5px 10px, 11px) |
| `.funnel-action.act-danger` | hover `--color-error-glow` | `--color-error-primary` | `--color-error-glow` | Ação destrutiva |
| `.funnel-action.act-warn` | hover `--color-warning-glow` | `--color-warning-primary` | `--color-warning-glow` | Ação de atenção |
| `.funnel-action.act-nav` | hover `rgba(0,208,255,0.1)` | `--color-primary-primary` | `rgba(0,208,255,0.3)` | Navegação cross-section |
| `.btn-modal-primary` / `.btn-modal-confirm` | `#7C3AED` (≈`--color-secondary-primary`) | `#fff` | none | CTA de modal (10px 20px) |
| `.btn-modal-cancel` | transparent | `--text-primary` | `--glass-border` | Cancelar modal |

**Estados universais:**
- `:disabled` / `[disabled]` → `opacity: 0.5`, `cursor: not-allowed`, `filter: grayscale(0.3)`, `pointer-events: none`.
- `.is-loading` → texto transparente + spinner central (14×14, borda branca 30% + top `#fff`, 0.7s linear).

### 8.3 Inputs e Filtros

- `.input` (base unificada): fundo `rgba(255,255,255,0.04)`, borda `--glass-border`, padding `8px 12px`, radius 8px, cor `--text-primary`, fonte sys 14px. Focus → borda `--color-primary-primary`. `.is-error` → borda `--color-error-primary`.
- `.filter-bar`: card horizontal com `gap: 12px`, padding `20px 24px`, alinhamento `flex-end`.
- `.filter-group`: coluna label + input com gap 4px.
- `.filter-label`: 11px uppercase `--text-secondary`, letter-spacing 0.05em.
- `.filter-divider`: 1×32px, cor `--glass-border`.
- Inputs `date` → `color-scheme: dark`.

### 8.4 Sidebar e Navegação

- `.nav-item` — 12px padding, radius 8px, cor `--text-secondary`, transição 0.3s. Hover: fundo `rgba(255,255,255,0.05)` + cor primária de texto. Ativo: `background: var(--color-primary-primary)`, texto `#fff`, shadow `0 4px 15px var(--color-primary-glow)`.
- Ícones: 22×22, `flex-shrink: 0`.
- Labels `span` animam opacidade/largura em 0.3s ao expandir sidebar.
- Avatar: 48×48 circular, borda `--glass-border`, `margin-bottom: 40px`.
- Footer: `margin-top: auto`, `padding-top: 24px`, `border-top: 1px solid --glass-border`.

### 8.5 Header global (`.global-header`)

- Altura 80px, `sticky top:0`, fundo `rgba(6,7,9,0.8)` + blur 12px.
- `.selector`: botão-pill de filtro (8px 12px, radius 8px, fundo `--bg-surface`, borda `--glass-border`). Hover → `--bg-surface-hover`.
- `.system-status`: grupo de pills à direita, `gap: 24px`, 13px, `--text-secondary`.
- `.status-pill .dot`: 8px circular com `box-shadow: 0 0 10px currentColor`. A cor é definida pelo estado (verde/âmbar/vermelho).

### 8.6 KPI (`.kpi-row`, `.kpi-value`, `.kpi-delta`, `.sparkline`)

- Linha: `display: flex; align-items: baseline; gap: 12px`.
- Valor: Syne 28px/700.
- Delta: pill 12px/600, radius 8px, classes `bg-success-soft | bg-error-soft | bg-warning-soft` (cor + glow semântico).
- Sparkline: `width: 100%; height: 30px; margin-top: 12px`.
- Indicador triangular complementar: `.tri-indicator` (14×14) com fills `--color-*-glow` e stroke semântico, colocado após o delta.

### 8.7 Funnel

- `.funnel-row`: label (220px, 14px, `--text-secondary`) · barra flex · valor (80px, direita, Syne 600).
- `.f-bar-bg`: 10px de altura, fundo `rgba(255,255,255,0.05)`, radius 5px.
- `.f-bar-fg`: transição de largura 1.5s `cubic-bezier(0.16,1,0.3,1)`.
- `.funnel-kpi` (linha de KPIs do funil): mini-cards com fundo `rgba(255,255,255,0.02)`, borda `--glass-border`, padding 16px, centralizado; valor 22px Syne 700.

### 8.8 Stacked Bar (`.stacked-bar` + `.bar-segment`)

- Altura 12px, radius 6px. Segmentos com classes `bg-success | bg-error | bg-warning` (background sólido + `box-shadow: 0 0 10px var(--color-*-glow)`).

### 8.9 Badges (`.badge`)

4–10px padding, radius 8px, 11px/600 UPPERCASE. Variantes:
`badge-success` · `badge-error` · `badge-warning` · `badge-blue` · `badge-purple` · `badge-gray`.

Badges tipadas alternativas (font 10px):
- `.badge-type-original` — fundo `rgba(255,255,255,0.04)`, texto `--text-secondary`.
- `.badge-type-revisao` — fundo `rgba(139,92,246,0.15)`, texto `#A78BFA`.

### 8.10 Tabelas (`.table-engine`)

- Header: 12px UPPERCASE `--text-secondary`, borda inferior `--glass-border`, letter-spacing 0.05em.
- Células: 16px 12px, 14px, borda inferior `rgba(255,255,255,0.02)`.
- Hover de linha: `background: --bg-surface-hover`.
- `.mono` em IDs/hashes (JetBrains Mono 12px `--text-secondary`).
- Variante agregada: `.table-funnel-agg` (header 10px, padding 14px 12px).

### 8.11 Alerts (`.alert-box`)

Padding 16px, radius 8px, margin-bottom 12px.
- `.alert-error` — fundo + borda `--color-error-glow`, título `--color-error-primary`.
- `.alert-warning` — fundo + borda `--color-warning-glow`, título `--color-warning-primary`.
- Corpo do alerta: `p` em 13px `--text-primary` com `opacity: 0.85`.

### 8.12 Event Stream (`.event-stream`)

Lista 13px, `max-height: 280px`, scroll vertical. `.e-row` com `border-bottom: 1px dashed --glass-border`. `.e-time` mono 11px `--text-secondary`.

### 8.13 Donut de Pagamentos (`.payment-dynamic-card`)

- Container 160×160, SVG rotacionado -90°, stroke-width 50.
- `.donut-bg` stroke `--bg-surface-hover`, segmentos com cor semântica + transição 1s.
- `.payment-selector-item.active` → borda esquerda 2px `--color-primary-primary`.
- `.p-legend-title .ldot` → 8px circular com glow (`box-shadow: 0 0 8px currentColor`).

### 8.14 Timeline (`.timeline`)

Linha vertical 2px à esquerda (`--glass-border`). Marcadores 12px circulares com borda semântica e `box-shadow: 0 0 8px var(--color-*-glow)`.
Variantes: `tl-success | tl-error | tl-info | tl-warning | tl-purple` (com aliases `tl-green|red|blue|yellow`).

### 8.15 Comparison Grid (`.comparison-grid`)

Grid 1fr 1fr, gap 12px. Célula com fundo `rgba(255,255,255,0.02)`, borda `--glass-border`, padding 16px. Label 11px UPPERCASE `--text-secondary`.

### 8.16 Modal (`.modal-backdrop` + `.modal-content`)

- Backdrop: overlay escuro `rgba(0,0,0,0.7)` + blur 6px, `z-index: 3000`.
- Content: 480px (max-vw 90%), radius 12px, padding 32px, fundo `rgba(20,22,26,0.98)`, borda `--glass-border`.
- Título em Syne.
- Info box (`.modal-info`): fundo/borda âmbar translúcida (`rgba(255,176,32,0.08/0.2)`), radius 8px, 12px, line-height 1.5.
- Ações alinhadas à direita, `gap: 12px`.

### 8.17 Drilldowns (`.drilldown-overlay`, `.hist-drilldown`)

Painéis laterais direitos fixos. 480–500px. `z-index: 1000–2000`. Fundo `rgba(10,11,14,0.95–0.97)` + blur 20–24px. Borda esquerda `--glass-border`. Sombra direita profunda (ver §5). Botão fechar (`.close-dd`) no topo-direita, cor `--text-secondary` → `--text-primary` em hover.

### 8.18 Upload (`.upload-dropzone`)

Borda tracejada `--glass-border`, radius 8px, padding 24px, fundo `rgba(255,255,255,0.02)`, texto `--text-secondary`. Input nativo visível abaixo.

### 8.19 Feedback

- `.spinner` (20×20) / `.spinner-lg` (36×36, border 3px) — borda `--glass-border` + top `--color-primary-primary`, animação `btn-spin` 0.7s.
- `.loading-state` — coluna centralizada, gap 12px, padding 48×24, texto `--text-secondary` 14px.
- `.toast` — pill 14px, radius 8px. Variantes `toast-success | toast-error | toast-info` (cor + glow semântico).
- `.empty-state` — padding 64×24, texto centralizado `--text-secondary`, SVG ilustrativo com `opacity: 0.4`.

### 8.20 Proof Image Box

Placeholder 100%×180px, fundo `rgba(255,255,255,0.03)`, borda dashed `--glass-border`, texto centralizado 13px `--text-secondary`.

---

## 9. Icon System

Componente `apps/web/components/Icon.tsx` — SVG stroke-based (fill:none, strokeWidth 2, lineCap/Join round), default 18px, `color: currentColor`.

**Catálogo (24 ícones):** `dashboard`, `filter`, `card`, `shield`, `target`, `history`, `settings`, `logout`, `chevron-right`, `calendar`, `link`, `pin`, `activity`, `layers`, `eye`, `refresh`, `x`, `file`, `upload`, `check`, `alert`, `arrow-up`, `arrow-down`.

Regras:
- Tamanhos usuais: 18 (inline), 22 (nav-item), 14 (tri-indicator).
- Sempre passar `aria-hidden` (já default no componente).
- Novos ícones devem seguir o mesmo viewBox 24×24 e stroke system.

---

## 10. Z-index

| Camada | Valor |
|---|---|
| Background image | `-1` |
| Header sticky | `50` |
| Sidebar | `1000` |
| Sidebar toggle | `1001` |
| Drilldown lateral | `1000` |
| Hist drilldown | `2000` |
| Modal backdrop/content | `3000` |

---

## 11. Estados semânticos (saúde do sistema)

Usado pelo header para saúde (`healthy | degraded | unknown`):
- **healthy** → dot verde `--color-success-primary` + glow.
- **degraded** → dot âmbar `--color-warning-primary` + glow.
- **unknown** → dot cinza `--color-text-muted`, sem glow forte.

---

## 12. Seções do index

O `index.tsx` é orquestrador: `Sidebar` + `Header` + `<Section>` dinâmica. Seções válidas (tipo `SectionId`):
`overview` · `funnel` · `payments` · `risk` · `campaigns` · `historico`.

Cada seção deve:
1. Envolver conteúdo em `.g-row`/`.g-col-*`.
2. Usar `.card` + `.card-title` como unidade atômica.
3. Aplicar `fadeIn` via classe `.dashboard-section.active` quando montada.
4. Não introduzir tokens novos — estender este documento antes.

---

## 13. Acessibilidade (obrigatório)

- Contraste mínimo AA para texto sobre `--bg-base`: `--text-primary` (15.8:1) e `--text-secondary` (9.2:1) atendem; `--text-muted` só para non-essential (≥ 4.5:1).
- Botões e nav-items devem expor `aria-label` quando só têm ícone (sidebar compacta).
- Todos os SVGs decorativos usam `aria-hidden="true"` (default no `Icon`).
- `color-scheme: dark` em `input[type=date]` para ícones nativos claros.
- Foco visível: inputs usam borda `--color-primary-primary`. Botões herdam o outline default do browser — não remover sem prover substituto.

---

## 14. Regras de extensão

1. **Nunca** adicionar hex literal fora do `:root` de `global.css`.
2. **Nunca** criar sombras, blurs ou durações novas sem atualizar §5 e §6.
3. **Nunca** inventar variantes de botão/badge — use as 12+ já documentadas.
4. Novos componentes devem reutilizar `.card`, `.btn-*`, `.input`, `.badge-*`, `.table-engine` como primitivos.
5. Fonte mono é restrita a ids, timestamps, hashes e códigos — não usar em UI de leitura.
6. Responsividade: único breakpoint suportado hoje é `1100px`. Qualquer outro valor precisa ser justificado e registrado aqui.

---

## 15. Tema (Dark + Light)

### 15.1 Mecanismo

O tema ativo é declarado em `<html data-theme="light|dark">`. Os tokens em `:root` (dark, default) são sobrescritos pelo seletor `[data-theme="light"]`. **Componentes nunca devem ler hex literais nem ter classes condicionais por tema** — basta usar os tokens.

```css
/* certo */
.card { background: var(--bg-surface); color: var(--text-primary); }

/* errado */
.card { background: #181D25; }
.card.light { background: #fff; }
```

### 15.2 Resolução do tema na primeira pintura

1. `localStorage["igb_theme"]` se existir (`"light"` ou `"dark"`)
2. `prefers-color-scheme: light` do SO
3. Default: `dark`

Implementado em `apps/web/state/ThemeContext.tsx`. Mudar via `useTheme().toggleTheme()` ou `setTheme("light"|"dark")`. Toggle visual = `<ThemeToggle />` (`apps/web/components/ThemeToggle.tsx`), com modo `compact` para sidebars colapsados.

### 15.3 Pontos de exposição do toggle

| Onde | Modo |
|---|---|
| `LandingPage` top-bar | `compact` (ícone) |
| `AdminLayout` sidebar-footer | full (expandido) / `compact` (colapsado) |
| `UserLayout` sidebar-footer | full / `compact` |
| `AffiliateLayout` sidebar-footer | full |

### 15.4 Regra de adição de novo token

Se um valor de cor / overlay / shadow precisa diferir entre temas, **adicione o token em ambos** os blocos (`:root` e `[data-theme="light"]`). Nunca use cores literais em componentes para "ajustar" o light theme.

---

## 16. Dívidas técnicas conhecidas

1. `box-shadow`, `backdrop-filter` e durações ainda não são tokens — candidatos a `--shadow-*`, `--blur-*`, `--duration-*` em próxima iteração.
2. `aria-live` regions ausentes em `.event-stream` e `.toast` — adicionar antes de qualquer feature com notificações acessíveis.
3. `.drilldown-overlay`, `.hist-drilldown`, `.modal-backdrop`, `.timeline`, `.comparison-grid` estão definidos mas não ainda renderizados pelo `index.tsx` atual — documentados aqui porque fazem parte da identidade e serão ativados em próximas seções.
4. Paleta antiga (azul `#3B82F6`, roxo `#A855F7`, vermelho `#EF4444`, âmbar `#F59E0B`) substituída pela paleta de 3 cores em PR posterior — remover do código de bibliotecas/componentes que ainda referenciem por valor literal.

---

**Última sincronização com código:** este documento reflete `apps/web/styles/global.css` e `apps/web/pages/index.tsx` na branch `feature/backend-foundation-sprint-0.1`. Ao alterar tokens ou componentes, atualize este arquivo **na mesma PR**.
