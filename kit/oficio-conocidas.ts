// Función pura, sin imports: sólo compara datos ya medidos. La usa `oficio.ts` cuando
// `oficioSinFallas` recibe `conocidas` (skill nuevo-proyecto, adopción del kit).

export type EstadoMedidaOficio = 'pass' | 'fail' | 'n/a'

export type MedidaOficioConocidas = { id: string; estado: EstadoMedidaOficio }

export type RoturaOficioConocidas<M extends MedidaOficioConocidas = MedidaOficioConocidas> = {
  fallasNoConocidas: M[]
  conocidasQuePasan: string[]
  conocidasInexistentes: string[]
  conocidasNoMedibles: string[]
}

/**
 * Compara las medidas de un estado del e2e contra la lista de IDs conocidos de ese estado y separa
 * qué rompe: una falla no conocida, una conocida que ahora da `pass` o `n/a` (hay que sacarla de la
 * lista; una lista de conocidas no guarda entradas viejas) o un ID conocido que no aparece entre las
 * medidas. Genérica en el tipo de medida (`M`) para que `fallasNoConocidas` devuelva las medidas
 * completas (con sus campos propios, como `valor` o `detalle`), no sólo la forma mínima de
 * `MedidaOficioConocidas`.
 */
export function evaluarOficioConocidas<M extends MedidaOficioConocidas>(
  medidas: readonly M[],
  conocidas: readonly string[],
): RoturaOficioConocidas<M> {
  const conocidasVistas = new Set(conocidas)
  const idsMedidos = new Set(medidas.map((medida) => medida.id))
  const fallasNoConocidas = medidas.filter(
    (medida) => medida.estado === 'fail' && !conocidasVistas.has(medida.id),
  )
  const conocidasQuePasan = medidas
    .filter((medida) => conocidasVistas.has(medida.id) && medida.estado === 'pass')
    .map((medida) => medida.id)
  const conocidasNoMedibles = medidas
    .filter((medida) => conocidasVistas.has(medida.id) && medida.estado === 'n/a')
    .map((medida) => medida.id)
  const conocidasInexistentes = conocidas.filter((id) => !idsMedidos.has(id))
  return {
    fallasNoConocidas,
    conocidasQuePasan,
    conocidasInexistentes,
    conocidasNoMedibles,
  }
}

/** true si algo de lo que devolvió `evaluarOficioConocidas` tiene que romper el estado. */
export function rompeOficioConocidas<M extends MedidaOficioConocidas>(
  rotura: RoturaOficioConocidas<M>,
): boolean {
  return (
    rotura.fallasNoConocidas.length > 0 ||
    rotura.conocidasQuePasan.length > 0 ||
    rotura.conocidasInexistentes.length > 0 ||
    rotura.conocidasNoMedibles.length > 0
  )
}
