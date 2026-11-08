# Procedencia de `components/ui`

Registro de los archivos copiados con el CLI de shadcn. Los archivos no traen ninguna marca y el
registro remoto no publica un SHA: esta tabla es la única forma de saber qué se copió y qué se cambió.
Se enlaza desde la sección «Canonical components» de `design/DESIGN.md`. Se actualiza en el mismo cambio
que copia, reescribe o actualiza un componente (skill implementar-interfaz, componentes shadcn).

Inicialización: los tres archivos se tomaron el 2026-11-07 del fixture del kit de la base
(`skills/nuevo-proyecto/fixtures/kit/frontend/`), que los copió con `npx shadcn@4.21.0 init -y -b base
-p nova` (`components.json` con `"style": "base-nova"`) y `npx shadcn@4.21.0 eject`, y ya los
reescribió al piso AA; `components.json` se copió del mismo fixture y el CLI queda fijado en
`devDependencies`. Tema (`src/index.css`): el bloque `:root` del preset se reemplazó por variables
que apuntan a los tokens del contrato (`design/tokens.json`).

| Archivo      | CLI    | Estilo    | Fecha de copia                             | Cambios locales y motivo                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------ | ------ | --------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `badge.tsx`  | 4.21.0 | base-nova | 2026-11-07 (del fixture, copia 2026-09-17) | formato Prettier del proyecto; contorno de foco sólido (ver «Foco»)                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `button.tsx` | 4.21.0 | base-nova | 2026-11-07 (del fixture, copia 2026-09-17) | variante `destructive` con fondo sólido (la original daba 3,82:1, bajo AA); objetivo táctil: cada tamaño usa `h-11`/`size-11` y recupera su alto shadcn sólo desde `md:` y con mouse (`md:pointer-fine:`, 2026-11-08: con el dedo mide 44 px a cualquier ancho, así el teléfono apaisado no baja a 28 o 36 px); contorno de foco sólido                                                                                                                                                                              |
| `dialog.tsx` | 4.21.0 | base-nova | 2026-11-07 (del fixture, copia 2026-09-17) | formato Prettier del proyecto; contorno de foco sólido en `DialogContent` (regla `oficio/sin-foco-oculto`); 2026-11-08, para la tira apaisada: `DialogContent` con `variant="fullscreen"` (todo el viewport, sin centrar, sin `sm:max-w-sm` ni zoom, sin overlay, fondo de página, fundido con `duracion-larga` sólo bajo `motion-safe:`, así `prefers-reduced-motion` lo apaga) y `DialogTitle` con `variant="plain"` (sin `text-base leading-none font-medium`, que le ganaban al estilo `enunciado` del contrato) |

Foco: el anillo traslúcido del preset (`ring-3 ring-ring/50`, 1,55:1 sobre blanco) pasa a un contorno
sólido `focus-visible:outline-2 outline-solid outline-offset-2 outline-ring`, con `--ring` apuntando a
`--foco` del contrato.

Bloque `.dark` del tema retirado: el contrato no contempla modo oscuro y sus tokens no se verificaron
contra fondos oscuros; `@custom-variant dark` se conserva para que las clases `dark:` de los
componentes copiados compilen sin aplicarse.

Última actualización revisada con `add <componente> --diff`: 2026-09-17 en el fixture de origen, CLI
4.21.0.
