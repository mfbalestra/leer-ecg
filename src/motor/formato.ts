// Cifras en el formato de la página (español rioplatense): coma decimal y punto de miles.

const formateadores = new Map<number, Intl.NumberFormat>()

function formateador(decimales: number): Intl.NumberFormat {
  let f = formateadores.get(decimales)
  if (!f) {
    f = new Intl.NumberFormat('es-AR', {
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales,
    })
    formateadores.set(decimales, f)
  }
  return f
}

export function numero(valor: number, decimales = 0): string {
  return formateador(decimales).format(valor)
}

export function milisegundos(ms: number): string {
  return `${numero(ms)} ms`
}

export function segundos(s: number, decimales = 2): string {
  return `${numero(s, decimales)} s`
}

export function latidosPorMinuto(lpm: number): string {
  return `${numero(lpm)} lpm`
}

export function milivoltios(mv: number, decimales = 1): string {
  return `${numero(mv, decimales)} mV`
}
