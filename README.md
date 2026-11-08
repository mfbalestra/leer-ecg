# Leer las rayitas

Entrenador interactivo para aprender a leer un electrocardiograma: retos cortos con corrección
inmediata, en cinco niveles (el papel, un latido, la frecuencia, el ritmo y la lectura completa). Lo
que se erra vuelve con otros números. Es una página estática pensada para GitHub Pages y para el
celular; el progreso se guarda en el navegador.

Material de estudio: no reemplaza la formación clínica. Los valores normales que enseña salen de
páginas de referencia citadas en la pantalla «Valores normales y fuentes» (`src/motor/valores.ts`).

## Requisitos

- Node 24.15 o superior, con npm 11.
- Git (para que el build estampe el commit en `version.json`).
- Playwright descarga Chromium la primera vez que se corre el circuito en navegador.

## Desde cero

1. `git clone <este repositorio>` y entrar a la carpeta.
2. `npm ci`
3. `npm run dev` y abrir http://localhost:5173/
4. `npm run check` — la verificación completa: formato, lint, tipos, alineación de `@types`, tests
   unitarios y de propiedades, mapa de funcionalidades y consola. Es la definición de terminado.
5. `npx playwright install chromium` una vez y después `npm run check:entrega` — suma el circuito
   en navegador con axe, teclado y oficio por estado.

No hay `.env`: la app no tiene backend ni variables de entorno.

## Comandos

`npm run operar` abre la consola del proyecto con todos los comandos; cada uno también corre solo
(`npm run build`, `npm run preview`, `npm run test`, `npm run e2e`, …). `node consola/operar.mjs
--listar-json` los lista sin menú.

## Publicación

`.github/workflows/pages.yml` corre `npm run check`, compila y publica `dist/` en GitHub Pages en
cada push a `main`. Hace falta activar Pages en el repositorio con origen «GitHub Actions» (Settings
→ Pages). El build escribe `dist/version.json` con versión, commit y fecha; la portada muestra la
versión al pie. Volver atrás es volver a correr el workflow sobre el commit anterior (Actions →
Re-run) o revertir el commit en `main`.

Para reproducir una partida, la dirección admite `?semilla=N`: la misma semilla genera la misma
secuencia de retos.

## Estructura

- `src/motor/`: el motor sin interfaz. `papel.ts` (qué mide cada cuadrado), `latido.ts` (el modelo
  del latido y la generación de tiras), `retos.ts` (los retos y sus respuestas, derivadas de los
  mismos parámetros que dibujan la tira), `sesion.ts` (cola, racha y repetición de lo errado),
  `progreso.ts` (guardado en el navegador), `valores.ts` (valores normales con su fuente).
- `src/componentes/`: el papel, la tira con sus marcas y zonas para tocar, el contador y las
  opciones.
- `src/pantallas/`: inicio, nivel y referencias. `src/App.tsx` las enlaza; hay una sola ruta.
- `design/`: el contrato visual (`DESIGN.md`, `tokens.json`, `semilla.json`); `src/design-tokens.css`
  se genera desde `tokens.json`.
- `kit/`: el kit de verificación de la base, copiado como código propio.
- `e2e/`: el circuito Playwright. `.agents/skills/verificar-leer-ecg/`: cómo levantar y probar la app.
- `consola/`: la consola del proyecto (`npm run operar`).
