export async function seleccionar({ mensaje, opciones }) {
  let clack
  try {
    clack = await import('@clack/prompts')
  } catch (error) {
    if (error?.code === 'ERR_MODULE_NOT_FOUND') {
      throw new Error('Falta @clack/prompts. Ejecutá npm ci o abrí la consola con --simple.')
    }
    throw error
  }
  const respuesta = await clack.select({
    message: `${mensaje}\n↑/↓ para elegir · Enter para confirmar · Ctrl+C para salir`,
    options: opciones,
    initialValue: opciones[0]?.value,
    showInstructions: false,
  })
  if (clack.isCancel(respuesta)) {
    const cancelacion = new Error('Cancelado por la persona operadora.')
    cancelacion.code = 'CONSOLE_CANCELADA'
    throw cancelacion
  }
  return respuesta
}
