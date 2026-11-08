// Registro único de la consola: una entrada por automatización del proyecto. Cada entrada envuelve
// un script de package.json que también corre solo; la consola sólo lo hace encontrable.
// Regla de vida: toda automatización nueva se registra acá en el mismo cambio que la crea.

const npm = (script, etiqueta, descripcion, extra = {}) => ({
  script,
  etiqueta,
  descripcion,
  programa: process.platform === 'win32' ? 'npm.cmd' : 'npm',
  args: ['run', script],
  parametros: [],
  destructiva: false,
  modifica: false,
  ...extra,
})

export const registro = {
  automatizaciones: [
    npm(
      'dev',
      'Levantar el entrenador',
      'Servidor de desarrollo de Vite en http://localhost:5173.',
    ),
    npm(
      'build',
      'Compilar para publicar',
      'Tipos y build de producción en dist/, con version.json.',
      {
        modifica: true,
      },
    ),
    npm('preview', 'Ver el build', 'Sirve dist/ como lo haría GitHub Pages.'),
    npm(
      'check',
      'Verificar todo',
      'Formato, lint, tipos, tests unitarios y de propiedades, mapa y consola.',
    ),
    npm(
      'check:entrega',
      'Verificar para entregar',
      'Todo lo de check más el circuito Playwright con axe.',
    ),
    npm('test', 'Tests unitarios', 'Vitest una vez, sin vigilancia.'),
    npm('e2e', 'Circuito en navegador', 'Playwright con axe, teclado y oficio por estado.'),
    npm('format', 'Chequear formato', 'Prettier en modo chequeo: no escribe.'),
    npm('lint', 'Lint', 'ESLint con tipos sobre src, e2e y kit.'),
    npm('typecheck', 'Tipos', 'tsc -b sin emitir.'),
    npm('types', 'Alineación de @types', 'Compara cada @types/* con el paquete que tipa.'),
    npm('mapa', 'Mapa de funcionalidades', 'Compara la skill de verificación con las rutas.'),
    npm('consola:verificar', 'Verificar esta consola', 'Compara package.json con este registro.'),
  ],
  exclusionesDocumentadas: [],
  excluidos: [{ script: 'operar', motivo: 'Es la entrada del menú, no se invoca recursivamente.' }],
}
