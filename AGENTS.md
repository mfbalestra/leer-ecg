# leer-ecg

Entrenador estático para aprender a leer un electrocardiograma, publicado en GitHub Pages. Sin
backend: todo corre en el navegador.

## Commands

- Install: `npm ci`
- Run: `npm run dev`
- Test: `npm run test`
- Verify: `npm run check`; before a delivery, `npm run check:entrega` (needs `npx playwright install
chromium` once)
- Console: `npm run operar`

## Contracts

- Visual contract: `design/DESIGN.md` with `design/tokens.json`; read before touching any screen,
  component or style. `src/design-tokens.css` is generated from `tokens.json`, never edited.
- Copied shadcn components: `src/components/ui/PROCEDENCIA.md` records every copy and local change.
- Verification skill and feature map: `.agents/skills/verificar-leer-ecg/SKILL.md`; `check` fails
  when a screen route lacks its row or its journey.
- Product: `docs/PRD.md`.

## Non-obvious constraints

- Every normal value the trainer teaches lives in `src/motor/valores.ts` with the URL and quote it was
  taken from; never add or change a number from memory.
- A challenge's correct answer is derived from the same parameters that draw the strip
  (`src/motor/retos.ts`), never recomputed from pixels; the property tests enforce it.
- `src/motor/reloj.ts` is the only module that reads the clock; the kit's own-rules lint enforces it.
- Figures are written in the page's locale through `src/motor/formato.ts` (comma decimal, point
  thousands).
- Scope: personal, declared 2026-11-07 (the owner did not declare work scope).
- Stack: standard frontend of the base (React 19, TypeScript 6, Vite 8, Tailwind 4, shadcn on Base
  UI), one route and no router, decided 2026-11-07. No backend, so no Python/Node kit and no OpenAPI
  contract (2026-11-07).
- Verification kit: frontend profile plus TypeScript base copied on 2026-11-07 from the base at
  commit 2d94ec1f; `api:*` scripts left out because there is no contract.
- Standards adapted on 2026-11-07, base commit 2d94ec1f.
- Deployment: GitHub Pages from `main` through `.github/workflows/pages.yml`; `vite.config.ts` uses a
  relative base and stamps version, commit and date into the build.
- Visual acceptance: pending the user (2026-11-07). The identity was built on the direct route
  without the three-proposal round because the owner asked to implement at once.
- Branch strategy: one new branch per change, integrated into `main` afterwards (2026-11-08).

## Maintaining these instructions

- They load in every agent session: keep only what governs every task here (commands, contracts,
  constraints no file name or tool reveals).
- One line per constraint; its reason lives in the spec or commit that decided it, linked if needed.
- No status, history, measurements or decision log: work state lives in specs, the PRD and Git.
- A declined convention is one dated line under `Non-obvious constraints`; do not generate or propose
  it again unless the owner asks.
- Update this file in the same change that moves commands, structure or contracts, and keep it to at
  most 150 lines.
