# Entrenador de ECG

Estado: borrador — 2026-11-07
Versión: 1
Formato: 2
Ámbito: personal
Dueño de producto: Marco Balestra

## Problema y resultado buscado

Quien empieza a estudiar electrocardiografía se traba antes de la interpretación: no sabe qué vale
cada cuadradito del papel ni cómo se llaman las partes de un latido, y los apuntes lo explican con
texto y láminas que no se practican. Se busca que, con sesiones de pocos minutos y retos que se
corrigen al instante, la persona llegue a medir una frecuencia, decir si un ritmo es regular y juzgar
un PR y un QRS sin ayuda.

## Usuarios y recorridos

- **Estudiante que arranca**: abre la página en el celular, juega el nivel que la portada le marca
  como siguiente, contesta retos de 20 a 30 segundos, ve por qué erró y sigue; cuando cierra los
  cuatro niveles base, hace la lectura completa con reloj y vuelve a repetirla para mejorar.
- **Quien repasa**: entra a un nivel ya completado para refrescar antes de un parcial, o a la tabla de
  valores normales con sus fuentes.

## Alcance por hitos

| ID  | Entrega exigida                                                                                                                                                                                                                                           | Límite deliberado                                                                                                                                           | Estado    |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| H-1 | Entrenador publicado en GitHub Pages con cinco niveles (papel, latido, frecuencia, ritmo e intervalos, lectura completa), corrección inmediata, repetición de lo errado, racha, progreso guardado en el navegador y tabla de valores normales con fuentes | Sin patologías (bloqueos avanzados, fibrilación como diagnóstico, infarto), sin eje eléctrico, sin sonido, sin cuentas ni sincronización entre dispositivos | pendiente |
| H-2 | Niveles de patologías clásicas: bloqueos AV, bloqueos de rama, fibrilación y aleteo auricular, elevación del ST                                                                                                                                           | Sin tiras reales (siguen siendo dibujadas); sin derivaciones múltiples                                                                                      | pendiente |

## Fuera de alcance

Un curso completo de electrocardiografía, el electrocardiograma de doce derivaciones y cualquier uso
clínico: es material de estudio y lo dice en pantalla.

## Conceptos del dominio

- Tira: el trazado dibujado sobre papel milimetrado durante unos segundos, a 25 mm/s y 10 mm/mV.
- Reto: una consigna con una sola respuesta correcta, derivada de los parámetros con los que se dibujó
  la tira.
- Racha: aciertos seguidos dentro de un nivel.

## Requisitos

- **RF-01** (H-1): Cada nivel presenta retos generados al azar cuya respuesta correcta sale de los
  mismos parámetros que dibujan la tira; un reto errado vuelve, con otros números, más adelante en el
  mismo nivel, y uno acertado no se repite.
- **RF-02** (H-1): Al responder, la pantalla dice si estuvo bien o mal, con una línea de explicación
  que incluye la respuesta correcta, y recién entonces ofrece «Siguiente».
- **RF-03** (H-1): El nivel se completa al alcanzar su meta de aciertos; el cierre muestra aciertos,
  errores y mejor racha. La lectura completa muestra además el tiempo total.
- **RF-04** (H-1): La portada marca el siguiente nivel recomendado, muestra los completados y el mejor
  resultado de la lectura completa; el progreso sobrevive a recargar la página en el mismo navegador.
- **RF-05** (H-1): Todo valor normal que se enseña cita su fuente en la pantalla de referencias.
- **RNF-01** (H-1): La página es estática, se publica en GitHub Pages y funciona en un celular de
  390 px de ancho sin desplazamiento horizontal.
- **RNF-02** (H-1): Accesibilidad WCAG 2.1 AA: todo reto se contesta con teclado, los objetivos
  táctiles miden al menos 44 px en el celular y el acierto o el error no dependen sólo del color.
- **RNF-03** (H-1): Si el navegador no permite guardar, la app juega igual y sólo deja de recordar el
  progreso.

## Criterios de aceptación de producto

- **AC-01** (H-1; RF-01): En cualquier nivel, errar un reto y acertar los dos siguientes hace que el
  mismo tipo de reto vuelva con otros valores; se comprueba con los tests de propiedades de la sesión
  y jugándolo en el navegador.
- **AC-02** (H-1; RF-02, RF-03): Jugar el nivel 1 con un error y el resto aciertos termina en «Nivel 1
  completo» con la cuenta correcta; se comprueba con el circuito Playwright `e2e/entrenador.spec.ts`.
- **AC-03** (H-1; RF-04, RNF-03): Completar un nivel, recargar la página y ver la marca «Completado»;
  con el almacenamiento bloqueado, la app abre y juega igual; se comprueba en el circuito Playwright y
  a mano en una ventana privada con almacenamiento bloqueado.
- **AC-04** (H-1; RF-05): Cada fila de la pantalla de referencias enlaza a la página de donde salió el
  valor; se comprueba leyendo `src/motor/valores.ts` contra la pantalla.
- **AC-05** (H-1; RNF-01, RNF-02): A 390 px y a 1440 px cada estado pasa axe, el recorrido por
  teclado y las medidas de oficio del kit; se comprueba con `npm run check:entrega`.

## Restricciones y límites de autorización

No se toca ningún dato personal: no hay cuentas, el progreso vive sólo en el navegador de la persona y
no se envía a ningún servicio. No hay servicios externos en tiempo de ejecución. Se publica en GitHub
Pages del repositorio del dueño. Ningún agente agrega valores clínicos sin una fuente citada ni
publica a un dominio distinto sin pedido del dueño.

## Preguntas abiertas

- Sonido opcional al acertar y al cerrar un nivel: recomendación, dejarlo para después de ver si la
  racha visible alcanza como refuerzo; impacto nulo en el motor, sólo un interruptor y dos sonidos.

## Historial

| Fecha      | IDs afectados | Cambio                                                     | Motivo                        |
| ---------- | ------------- | ---------------------------------------------------------- | ----------------------------- |
| 2026-11-07 | todos         | Borrador inicial a partir de la propuesta aprobada en chat | Alcance de la primera versión |
