---
name: verificar-leer-ecg
description: Levanta Leer las rayitas (leer-ecg) y ejercita sus pantallas en vivo - inicio, un nivel con acierto y error, el cierre de nivel y las referencias. Usar para "verificá la app", "levantá y probá", "probá que funcione" o "fijate si el entrenador anda". Do NOT use para correr los tests unitarios, para revisar código ni para un cambio que nadie ejecutó todavía.
---

# Verificar leer-ecg

## Bring the app up

1. `npm ci`
2. `npm run dev -- --port 5199 --strictPort`

Expected: reachable at http://localhost:5199/. No environment variables: the app has no backend and
reads nothing from `.env`.

## Doctor

| Check                  | Command or URL                           | Expected                                                                              |
| ---------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------- |
| Health                 | http://localhost:5199/                   | The page renders the heading «Leer las rayitas» and five levels                       |
| Version                | `npm run build` then `dist/version.json` | `version`, `commit` and `fecha` match `package.json` and `git rev-parse --short HEAD` |
| Dependencies reachable | not applicable                           | No backend, database or third-party service                                           |
| Dev entry / login      | not applicable                           | No users or sign-in                                                                   |

## Feature map

| Feature                                                                                                                                                                | Entry | How to exercise                                                                                                                                         | Expected evidence                                                                                | Degraded state                                                                                                                                                             | Journey                |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| Portada, niveles y referencias; un nivel completo con acierto y error; tocar el trazado; el contador; la lectura completa con reloj; progreso guardado en el navegador | `/`   | Open `/?semilla=41` so the challenge sequence is reproducible, play level 1 answering one wrong and the rest right, open levels 2, 3 and 5, then reload | The level card shows «Completado» after reload; each state passes axe, keyboard and craft checks | Browser storage unavailable (private window with storage blocked, or `localStorage` throwing): the app plays normally and simply does not remember progress after a reload | e2e/entrenador.spec.ts |

## Evidence standard

- UI features: a desktop capture and a mobile capture of the working state, and of the degraded
  state named for that row.
- A dense region or a small detail is examined by cropping and enlarging that region, not judged
  from the full capture. With no crop path available, declare that degradation instead of judging
  anyway.
- Never claim verification from source, from the DOM, or from this skill's own text alone.

## Clean up

- Stop: the Vite dev server started on port 5199.
- Remove: the `leer-ecg.progreso.v1` key from the browser's local storage if a clean start is needed.

## Self-proof state

| Step                | Date       | Result | Note                                                                                                |
| ------------------- | ---------- | ------ | --------------------------------------------------------------------------------------------------- |
| Bring-up            | 2026-11-07 | pass   | `npm run dev -- --port 5199` served the app; Playwright's webServer uses the same command           |
| Doctor              | 2026-11-07 | pass   | Heading and five levels rendered; `dist/version.json` built with `commit: sin-git` (no commit yet)  |
| Feature map `/`     | 2026-11-07 | pass   | `npm run check:entrega` green: e2e/entrenador.spec.ts with axe, keyboard and craft checks per state |
| Maintenance verdict | 2026-11-07 | clean  | Generated with the project                                                                          |

## Agent guide

- Never edit product code from this skill — a failed step or a drifted feature-map row is a
  finding to report, never a fix to make here.
- A failed step during maintenance is a finding, never a silent doc edit to make the map agree
  with broken behavior.
- Re-run the relevant steps before updating any row in Self-proof state; never copy a previous
  result forward.
- Update this skill in the same commit that changes the feature it describes; the drift check in
  `check` fails until the feature map agrees with the code.
- Degraded states are provoked by configuration or a flag, never by breaking real infrastructure
  or touching real data.
