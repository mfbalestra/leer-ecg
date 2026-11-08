/**
 * Guard del contrato visual con `@shadcn/lint`. Desactivado por defecto: el paquete no publica preset
 * y cada regla exige acordar su contrato con el `DESIGN.md` del proyecto
 * (skill implementar-interfaz, lint de Tailwind). Para activarlo:
 *
 * 1. `npm i -D @shadcn/lint` y anotar la versión en «Non-obvious constraints» del `AGENTS.md`.
 * 2. En `eslint.config.mjs`: `import shadcn from '@shadcn/lint'` y pasar `plugin: shadcn`.
 * 3. Completar `reglas` con las que el proyecto acordó y sus opciones (cada regla toma
 *    `componentImports`, `mergeFunctions` y `variantFunctions`), y llamar con `activo: true`.
 * 4. Ejercitar un caso permitido y uno prohibido por regla antes de confiar en el resultado.
 */
export function guardTailwind({
  activo = false,
  plugin,
  archivos = ['src/**/*.{ts,tsx}'],
  reglas = {},
} = {}) {
  if (!activo) return []
  if (!plugin)
    throw new Error('guardTailwind: con activo=true hace falta pasar el plugin @shadcn/lint')
  return [{ files: archivos, plugins: { shadcn: plugin }, rules: reglas }]
}
