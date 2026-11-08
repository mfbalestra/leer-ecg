import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline/promises'
import { existsSync, statSync } from 'node:fs'
import path from 'node:path'

export class CancelacionConsola extends Error {
  constructor() {
    super('Cancelado por la persona operadora.')
    this.code = 'CONSOLE_CANCELADA'
  }
}

const esCancelacion = (error) => error?.code === 'CONSOLE_CANCELADA'

export function crearConsola({
  registro,
  raiz,
  titulo = 'Consola del proyecto',
  invocacion = 'node operar.mjs',
}) {
  const entradasPorDefecto = registro.automatizaciones

  function prepararComando(entrada, valores = [], cwd = raiz) {
    if (valores.length > entrada.parametros.length)
      throw new Error('Sobran parámetros; consultá --help.')
    const args = [...entrada.args]
    for (const [i, parametro] of entrada.parametros.entries()) {
      let valor = valores[i] || parametro.defecto || ''
      if (!valor) throw new Error(`Falta ${parametro.nombre}.`)
      if (/[\x00-\x1f\x7f]/.test(valor) || valor.length > 4096)
        throw new Error(`Valor inválido para ${parametro.nombre}.`)
      if (parametro.opciones && !parametro.opciones.includes(valor))
        throw new Error(`${parametro.nombre}: elegí ${parametro.opciones.join(', ')}.`)
      if (parametro.tipo === 'archivo' || parametro.tipo === 'directorio') {
        const destino = path.resolve(cwd, valor)
        if (!existsSync(destino)) throw new Error(`No existe ${parametro.nombre}: ${valor}`)
        const estado = statSync(destino)
        if (parametro.tipo === 'archivo' ? !estado.isFile() : !estado.isDirectory())
          throw new Error(`Tipo incorrecto para ${parametro.nombre}.`)
        valor = destino
      }
      if (parametro.tipo === 'switch') {
        if (valor === 'sí') args.push(parametro.flag)
      } else {
        if (parametro.flag) args.push(parametro.flag)
        args.push(valor)
      }
    }
    let programa = entrada.programa === 'node' ? process.execPath : entrada.programa
    let entorno = process.env
    if (programa === 'bash' && process.platform === 'win32') {
      const instalado = path.join(
        process.env.ProgramFiles || 'C:/Program Files',
        'Git',
        'bin',
        'bash.exe',
      )
      if (existsSync(instalado)) {
        programa = instalado
        const binarios = path.resolve(path.dirname(instalado), '../usr/bin')
        entorno = Object.fromEntries(
          Object.entries(process.env).filter(([clave]) => clave.toLowerCase() !== 'path'),
        )
        entorno.PATH = `${binarios}${path.delimiter}${process.env.PATH || ''}`
      }
    }
    return { programa, args, cwd, entorno }
  }

  function ejecutarProceso(comando) {
    return new Promise((resolve) => {
      const hijo = spawn(comando.programa, comando.args, {
        cwd: comando.cwd,
        env: comando.entorno,
        stdio: 'inherit',
        shell: false,
      })
      let cancelado = false
      const cancelar = () => {
        cancelado = true
        hijo.kill('SIGINT')
      }
      process.once('SIGINT', cancelar)
      hijo.once('error', (error) => {
        process.stderr.write(`ERROR: ${error.message}\n`)
      })
      hijo.once('close', (codigo, señal) => {
        process.removeListener('SIGINT', cancelar)
        resolve(cancelado || señal === 'SIGINT' ? 130 : (codigo ?? 1))
      })
    })
  }

  function ayuda(entrada) {
    const parametros = entrada.parametros
      .map((p) => `${p.nombre}${p.defecto ? `=${p.defecto}` : ''}`)
      .join(' ')
    return (
      `${entrada.etiqueta}\n${entrada.descripcion}\nUso: ${invocacion} ${entrada.script}${parametros ? ` ${parametros}` : ''}\n` +
      entrada.parametros
        .map(
          (p) =>
            `  ${p.nombre}: ${p.descripcion}${p.opciones ? ` (${p.opciones.join(' / ')})` : ''}`,
        )
        .join('\n')
    )
  }

  async function ejecutarEntrada(
    entrada,
    valores,
    { preguntar, escribir, ejecutar = ejecutarProceso, cwd = raiz } = {},
  ) {
    const comando = prepararComando(entrada, valores, cwd)
    escribir(
      `${entrada.etiqueta}\n${entrada.descripcion}\nComando: ${[comando.programa, ...comando.args].map((valor) => JSON.stringify(valor)).join(' ')}\n`,
    )
    if (entrada.destructiva) {
      const enSecoValido =
        Array.isArray(entrada.argsEnSeco) &&
        entrada.argsEnSeco.length > 0 &&
        entrada.argsEnSeco.every((valor) => typeof valor === 'string' && valor.trim())
      if (
        typeof entrada.confirmacion !== 'string' ||
        !entrada.confirmacion.trim() ||
        typeof entrada.efectos !== 'string' ||
        !entrada.efectos.trim() ||
        !enSecoValido
      ) {
        throw new Error('La entrada destructiva debe declarar confirmacion, efectos y argsEnSeco.')
      }
      if (!preguntar)
        throw new Error('La operación destructiva requiere terminal y confirmación explícita.')
      escribir(`Alcance: ${entrada.efectos}\n`)
      const respuesta = await preguntar(
        `Escribí ${entrada.confirmacion} para aplicar; Enter ejecuta en seco: `,
      )
      if (!respuesta) comando.args.push(...entrada.argsEnSeco)
      else if (respuesta !== entrada.confirmacion) {
        escribir('Cancelado.\n')
        return 0
      }
    } else if (entrada.modifica) {
      if (!preguntar)
        throw new Error('Este comando requiere confirmación interactiva; usá su script directo.')
      if ((await preguntar('¿Ejecutar? Escribí sí; Enter cancela: ')) !== 'sí') {
        escribir('Cancelado.\n')
        return 0
      }
    }
    const codigo = await ejecutar(comando)
    escribir(
      `resultado=${codigo === 0 ? 'OK' : codigo === 130 ? 'CANCELADO' : 'ERROR'}\ncodigo=${codigo}\n`,
    )
    return codigo
  }

  async function ejecutarDesdeMenu(entrada, { preguntar, escribir, ejecutar }) {
    const valores = []
    for (const parametro of entrada.parametros) {
      const valor = await preguntar(
        `${parametro.nombre}${parametro.defecto ? ` [${parametro.defecto}]` : ''} (/cancelar vuelve): `,
      )
      if (valor === '/cancelar') {
        escribir('Cancelado.\n')
        return
      }
      valores.push(valor)
    }
    try {
      await ejecutarEntrada(entrada, valores, { preguntar, escribir, ejecutar })
    } catch (error) {
      if (esCancelacion(error)) throw error
      escribir(`ERROR: ${error.message}\n`)
    }
  }

  async function menuSimple({ entradas, preguntar, escribir, ejecutar }) {
    while (true) {
      escribir(
        `\n${titulo}\n${entradas.map((entrada, indice) => `${indice + 1}. ${entrada.etiqueta}`).join('\n')}\n`,
      )
      const seleccion = await preguntar('Número, ?n para ayuda, o Enter para salir: ')
      if (!seleccion) return 0
      const verAyuda = seleccion.startsWith('?')
      const numero = verAyuda ? seleccion.slice(1) : seleccion
      const entrada = /^\d+$/.test(numero) ? entradas[Number(numero) - 1] : null
      if (!entrada) {
        escribir('Opción inválida.\n')
        continue
      }
      escribir(ayuda(entrada) + '\n')
      if (verAyuda) continue
      try {
        await ejecutarDesdeMenu(entrada, { preguntar, escribir, ejecutar })
      } catch (error) {
        if (esCancelacion(error)) return 130
        throw error
      }
    }
  }

  async function menuRico({ entradas, preguntar, escribir, ejecutar, seleccionar }) {
    while (true) {
      const seleccion = await seleccionar({
        mensaje: titulo,
        opciones: [
          ...entradas.map((entrada) => ({
            value: { accion: 'ejecutar', entrada },
            label: entrada.etiqueta,
            hint: entrada.descripcion,
          })),
          {
            value: { accion: 'ayuda' },
            label: 'Ver ayuda',
            hint: 'Consultar comandos sin ejecutarlos.',
          },
          { value: { accion: 'salir' }, label: 'Salir', hint: 'Cerrar la consola.' },
        ],
      })
      if (seleccion.accion === 'salir') return 0
      if (seleccion.accion === 'ayuda') {
        const ayudaSeleccionada = await seleccionar({
          mensaje: 'Ayuda de comandos',
          opciones: [
            ...entradas.map((entrada) => ({
              value: { accion: 'ayuda', entrada },
              label: entrada.etiqueta,
              hint: entrada.descripcion,
            })),
            { value: { accion: 'volver' }, label: 'Volver', hint: 'Regresar al menú principal.' },
          ],
        })
        if (ayudaSeleccionada.accion === 'volver') continue
        escribir(ayuda(ayudaSeleccionada.entrada) + '\n')
        continue
      }
      try {
        await ejecutarDesdeMenu(seleccion.entrada, { preguntar, escribir, ejecutar })
      } catch (error) {
        if (esCancelacion(error)) return 130
        throw error
      }
    }
  }

  async function menu({
    entradas = entradasPorDefecto,
    preguntar,
    escribir,
    ejecutar = ejecutarProceso,
    seleccionar,
  } = {}) {
    if (!preguntar)
      throw new Error('Sin terminal interactiva. Usá un comando directo, --help o --listar-json.')
    try {
      return seleccionar
        ? await menuRico({ entradas, preguntar, escribir, ejecutar, seleccionar })
        : await menuSimple({ entradas, preguntar, escribir, ejecutar })
    } catch (error) {
      if (esCancelacion(error)) return 130
      throw error
    }
  }

  async function preguntarLinea(texto) {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    let rechazar
    let cancelada = false
    const cancelar = () => {
      if (cancelada) return
      cancelada = true
      rl.close()
      rechazar?.(new CancelacionConsola())
    }
    process.once('SIGINT', cancelar)
    rl.once('SIGINT', cancelar)
    try {
      const respuesta = await new Promise((resolve, reject) => {
        rechazar = reject
        rl.question(texto).then(resolve, reject)
      })
      return respuesta
    } catch (error) {
      if (esCancelacion(error) || error?.code === 'ABORT_ERR') throw new CancelacionConsola()
      throw error
    } finally {
      process.removeListener('SIGINT', cancelar)
      rl.close()
    }
  }

  async function principal(argv = process.argv.slice(2)) {
    if (argv.length === 1 && argv[0] === '--listar-json') {
      console.log(JSON.stringify(registro))
      return 0
    }
    if (argv[0] === '--help' || argv[0] === '-h') {
      if (argv.length > 2) throw new Error('Uso: --help [comando]')
      const entrada = entradasPorDefecto.find((item) => item.script === argv[1])
      if (argv[1] && !entrada) throw new Error('Comando desconocido.')
      console.log(
        entrada
          ? ayuda(entrada)
          : `Uso: ${invocacion}\n${invocacion} --listar-json\n${invocacion} --simple\n${invocacion} --help <comando>\n${invocacion} <comando> [parámetros]\n\n${entradasPorDefecto.map((item) => `${item.script}: ${item.descripcion}`).join('\n')}`,
      )
      return 0
    }
    const simple = argv.length === 1 && argv[0] === '--simple'
    const entrada =
      !simple && argv.length ? entradasPorDefecto.find((item) => item.script === argv[0]) : null
    if (argv.length && !simple && !entrada) throw new Error('Comando desconocido; usá --help.')
    const interactiva = Boolean(process.stdin.isTTY && process.stdout.isTTY)
    if (!interactiva && !entrada)
      throw new Error(`Sin terminal interactiva. Usá ${invocacion} --help o --listar-json.`)
    const escribir = (texto) => process.stdout.write(texto)
    if (entrada) {
      try {
        return await ejecutarEntrada(entrada, argv.slice(1), {
          preguntar: interactiva ? preguntarLinea : undefined,
          escribir,
        })
      } catch (error) {
        if (esCancelacion(error)) return 130
        throw error
      }
    }
    let seleccionar
    if (!simple && process.env.TERM !== 'dumb') {
      const modulo = await import('./selector.mjs')
      seleccionar = modulo.seleccionar
    }
    return menu({ preguntar: preguntarLinea, escribir, seleccionar })
  }

  return { prepararComando, ejecutarProceso, ejecutarEntrada, ayuda, menu, principal }
}
