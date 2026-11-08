// Único módulo que lee la hora: los tests la fijan reemplazando `ahora`.

export function ahora(): number {
  return Date.now()
}
