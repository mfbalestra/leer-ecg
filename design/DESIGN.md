# Entrenador de ECG — DESIGN.md

## Identity and atmosphere

Un entrenador para aprender a leer el electrocardiograma, usado por estudiantes en el celular, en
sesiones de minutos. La identidad es el papel milimetrado del electrocardiograma llevado a la pantalla:
la cuadrícula rosada con sus líneas gruesas cada cinco, el trazo en tinta y, alrededor, un papel
cálido y tranquilo donde la consigna y las opciones no compiten con el trazado. Nada decorativo fuera
del papel: el dibujo del tema es el propio instrumento que se aprende a leer.

Direction defaults: operar (la pantalla de un reto): intermedia, una ruptura fuerte al abrir (la tira
o el latido ampliado dominan el primer viewport) y acento comprometido; el trazo late al acertar y el
cierre de nivel entra con el resorte; aceptación pendiente del dueño (2026-11-07). Leer (referencias):
sobria.

## Semantic palette

| Role        | Token (`tokens.json` name)                        | Use when                                                                     | Never for                     |
| ----------- | ------------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------- |
| page ground | `fondo`                                           | Fondo de toda la página                                                      | Tarjetas ni el papel          |
| surface     | `superficie`                                      | Tarjetas de nivel, panel de cierre, opciones en reposo                       | El papel del trazado          |
| text        | `texto`, `texto-tenue`                            | Texto principal; metadatos, descripciones, pies                              | Texto sobre `primario`        |
| primary     | `primario`, `primario-hover`, `primario-suave`    | Acción primaria («Empezar», «Siguiente»), avance, resalte del trazado        | Fondos amplios                |
| on primary  | `sobre-primario`                                  | Texto e íconos sobre `primario`                                              | Cualquier otro fondo          |
| success     | `exito`, `exito-suave`, `sobre-exito`             | Acierto: borde, texto y fondo tenue del aviso y de la opción correcta        | Decoración                    |
| warning     | `alerta`, `alerta-suave`                          | Advertencias (sin uso hoy)                                                   | Celebrar                      |
| danger      | `peligro`, `peligro-suave`, `sobre-peligro`       | Error: borde, texto y fondo tenue del aviso y de la opción elegida mal       | Acciones destructivas: no hay |
| streak      | `racha`                                           | La racha de aciertos, como texto con su ícono                                | Advertencias                  |
| paper       | `papel`, `papel-linea-fina`, `papel-linea-gruesa` | Fondo y cuadrícula del papel milimetrado, sólo dentro de `TiraEcg` y `Papel` | Tarjetas, botones             |
| trace       | `trazo`, `trazo-resalte`                          | El trazado y las marcas; sombreado y líneas de calibre                       | Texto corriente               |
| focus       | `foco`                                            | Contorno de foco de teclado, sólido                                          | Decoración                    |
| border      | `borde`                                           | Bordes de controles y tarjetas (3:1 sobre `fondo` y `superficie`)            | Texto                         |

Authored semantic complements (not derived base output): `sobre-primario`, `sobre-exito` y
`sobre-peligro` (texto sobre fondos llenos, `sobre` declarado), `papel`, `papel-linea-fina`,
`papel-linea-gruesa` (3:1 sobre `papel`, `grande`), `trazo` y `trazo-resalte` (sobre `papel`), `racha`
(sobre `fondo` y `superficie`); los estilos de tipo y las duraciones. Los tokens derivados `texto`,
`texto-tenue`, `primario`, `exito`, `alerta`, `peligro` y `borde` llevan `sobre` agregado a mano: al
re-derivar desde la semilla hay que conservarlo.

## Typography

Families: `sans` (Geist Variable, desde `@fontsource-variable/geist`, sin CDN), `mono` (Consolas y
equivalentes) — named as in `tokens.json`'s `type.families`.
Avoided on purpose: ninguna familia con serif ni display; la identidad está en el papel, no en la letra.

| Level   | Style (`tokens.json` name) | Use                                                                  |
| ------- | -------------------------- | -------------------------------------------------------------------- |
| display | `display`                  | Título de la portada y del cierre de nivel                           |
| title   | `titulo`                   | Título del nivel, encabezados de sección                             |
| prompt  | `enunciado`                | La consigna de cada reto: lo primero que se lee                      |
| body    | `cuerpo`                   | Texto corriente, explicaciones, opciones                             |
| caption | `pequeno`                  | Avance, racha, fuentes, pies                                         |
| figure  | `cifra`                    | Números de un vistazo (contador, puntaje, racha), con `tabular-nums` |

## Spacing, radii, elevation, motion

| Scale     | Token(s) (`tokens.json` names)                                                 | Use                                                                                                                                                                                                                                                  |
| --------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| spacing   | `espacio`                                                                      | Ritmo base; las utilidades de Tailwind lo multiplican                                                                                                                                                                                                |
| radius    | `radio`                                                                        | Único radio: tarjetas, botones, papel                                                                                                                                                                                                                |
| elevation | `elevacion` (none), `borde-plano`                                              | Los planos se separan por borde, no por sombra                                                                                                                                                                                                       |
| motion    | `curva`, `curva-momento`, `duracion-breve`, `duracion-media`, `duracion-larga` | `duracion-breve` con `curva` en hover y presión; `tira-pulso` (`duracion-larga`, `curva`) al acertar; `momento-entrada` (`duracion-larga`, `curva-momento`) sólo en el cierre de nivel. Sin Motion; `prefers-reduced-motion` apaga ambas animaciones |

## Composition and interaction

| Concern                         | Rule and exception                                                                                                                                                                     | Implemented by                                             |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Reading and work widths         | La pantalla de reto y la portada se acotan a `max-w-3xl`; el panel de cierre a `max-w-xl`. El papel ocupa todo el ancho; un latido solo se limita a 22 px por mm para no crecer de más | `src/pantallas/Nivel.tsx`, `src/componentes/TiraEcg.tsx`   |
| Alignment and reflow            | Una columna; en el celular las opciones se apilan y desde `sm` van en dos columnas; la tarjeta de nivel envuelve su botón debajo cuando no entra                                       | `src/componentes/Opciones.tsx`, `src/pantallas/Inicio.tsx` |
| Action hierarchy                | Una acción primaria por pantalla: el siguiente nivel en la portada, «Siguiente» o «Ver resultado» en el reto, «Volver a los niveles» en el cierre. Las demás son `outline` o `ghost`   | `src/pantallas/*.tsx`                                      |
| Information disclosure          | La consigna va antes del dibujo y las opciones después; la explicación aparece sólo al responder, en la región `status`                                                                | `src/pantallas/Nivel.tsx`                                  |
| Operation feedback and recovery | No hay operaciones remotas. Al responder, el aviso de acierto o error (ícono y texto, nunca sólo color) y el foco pasa a «Siguiente»; el cierre de nivel recibe el foco en su título   | `src/pantallas/Nivel.tsx`                                  |

## Identity assets

| Asset        | Source                                                                                                                 | Rule                                                                                                                   |
| ------------ | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Icon set     | `lucide-react` (trazo 2 px, 16 a 24 px)                                                                                | Sólo íconos de la librería; cada ícono decorativo lleva `aria-hidden` y uno solo nunca es el único indicador de estado |
| Favicon      | `public/favicon.svg`: un trazado blanco sobre `primario`, radio del contrato                                           | Generado con el proyecto; sin PNG de respaldo (sin conversor en el stack: brecha declarada)                            |
| Illustration | El papel milimetrado y el trazado, dibujados por código en `src/componentes/TiraEcg.tsx` y `src/componentes/Papel.tsx` | Es la única ilustración del producto; no se agregan dibujos del tema fuera del papel                                   |
| Logo         | —                                                                                                                      | No hay marca; el nombre va en texto                                                                                    |

## Canonical components

| Component | Path or import                 | Use when                                                                                                 | Never for                                  |
| --------- | ------------------------------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Button    | `@/components/ui/button`       | Toda acción; `default` para la primaria, `outline` o `ghost` para el resto, `link` para enlaces en línea | Las opciones de un reto (tienen su unidad) |
| Badge     | `@/components/ui/badge`        | Etiquetas cortas de estado (reservado)                                                                   | Texto corriente                            |
| Dialog    | `@/components/ui/dialog`       | Un diálogo modal (reservado)                                                                             | Avisos de acierto o error                  |
| TiraEcg   | `src/componentes/TiraEcg.tsx`  | Cualquier trazado sobre papel: tira, latido ampliado, portada; con marcas y zonas para tocar             | Fondos decorativos                         |
| Papel     | `src/componentes/Papel.tsx`    | Papel vacío con una parte resaltada (nivel 1)                                                            | Mostrar un trazado                         |
| Opciones  | `src/componentes/Opciones.tsx` | Respuesta por opciones de un reto, con el estado resuelto                                                | Navegación                                 |
| Conteo    | `src/componentes/Conteo.tsx`   | Respuesta numérica de un reto («¿cuántos?»)                                                              | Formularios                                |

Provenance of the copied shadcn files: `src/components/ui/PROCEDENCIA.md`.

New variants are proposed, not invented; approved ones land in the canonical component itself.

## Data representation

| Data kind           | Canonical form and purpose/context                                                   | Implemented by                                               |
| ------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| duration            | «40 ms», «0,04 s»: coma decimal, unidad separada por espacio                         | `src/motor/formato.ts` (`milisegundos`, `segundos`)          |
| heart rate          | «75 lpm»                                                                             | `src/motor/formato.ts` (`latidosPorMinuto`)                  |
| voltage             | «0,1 mV»                                                                             | `src/motor/formato.ts` (`milivoltios`)                       |
| count or score      | cifra en `cifra` con `tabular-nums`; «8 de 10» para avances                          | `src/motor/formato.ts` (`numero`), `src/pantallas/Nivel.tsx` |
| result of an answer | ícono (`CircleCheck` / `CircleX`) más texto «Bien.» / «No era esa.» y la explicación | `src/pantallas/Nivel.tsx` (`Retroalimentacion`)              |
| absent value        | "—", never a blank cell or "null"                                                    | (convention only — not yet in code)                          |

## Voice and copy

Language: español rioplatense, voseo, directo y cálido, sin jerga innecesaria; el término técnico va
acompañado de qué significa la primera vez. Capitalization: sólo la primera letra de cada frase y los
nombres propios; las siglas del dominio (QRS, PR, ST) en mayúscula.

| Instead of                  | Write            |
| --------------------------- | ---------------- |
| Incorrecto                  | No era esa.      |
| Haga clic en la onda P      | Tocá la onda P.  |
| Frecuencia cardíaca: 75 bpm | 75 lpm           |
| ¡Felicitaciones!            | Nivel 1 completo |

## Do / Don't

- **Do** reference a token for every color, size, shadow, and duration a token names. **Don't** hardcode
  a raw value a token already covers.
- **Do** dibujar el papel en milímetros reales (25 mm/s, 10 mm/mV) y dejar que escale. **Don't** usar
  una cuadrícula aproximada: la persona cuenta cuadrados y tienen que ser los de verdad.
- **Do** acompañar cada estado de acierto o error con ícono y texto. **Don't** indicarlo sólo con
  color.
- **Do** mantener la consigna y el dibujo en el primer viewport del celular. **Don't** poner texto de
  teoría antes del reto.

## Accessibility floor

- [x] Text contrast ≥ 4.5:1 (3:1 for large text); the checker verifies every pair `tokens.json` marks
      with `sobre` — mark the pairs that carry this criterion.
- [x] Visible keyboard focus on every interactive element (`foco`, contorno sólido de 2 px).
- [x] Touch targets ≥ 44×44 px below 768 px of width, ≥ 24×24 px wider (botones `h-11`; zonas del
      latido ensanchadas en `src/motor/retos.ts`).
- [x] `prefers-reduced-motion` respected wherever motion exists.

## Visual signature

El papel milimetrado rosado con el trazo en tinta, siempre a escala real; una sola acción primaria
en verde azulado sobre papel cálido; el acierto que hace latir el trazo.

## Agent guide

- On conflict: `tokens.json` values > this file > your taste. Report drift; never patch either side
  silently.
- Change the visual style only through an identity change the owner approves; within the contract, push
  expression with its tokens.
- Read a component's usage block at its definition before invoking it; never build from a row alone.
- Update units, states, tokens, and approved variants within the authorized surface; ask before changing
  identity, adding a variant beyond that scope, or restructuring this contract.
- Update this file in the same change that alters a token, component, or rule it describes, then verify
  every path it names still resolves and every token it names still exists in `tokens.json`.
- Verify rendered output visually when a browser is available.
