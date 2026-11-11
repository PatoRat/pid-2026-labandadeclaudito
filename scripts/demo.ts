// Levanta TODO el proyecto con un solo comando y sin instalar nada:
//
//   npm install
//   npm run demo
//
// No hace falta tener PostgreSQL en la máquina. El paquete embedded-postgres
// trae los binarios reales de Postgres (los baja npm según el sistema
// operativo) y este script los arranca desde la carpeta del proyecto, crea la
// base, aplica las migraciones, carga los datos de demo y levanta Next.
//
// Pensado para quien recibe el proyecto en un ZIP. Para el día a día está
// `npm run dev`, que usa el Postgres configurado en el .env.
import { spawn } from 'node:child_process'
import { existsSync, readdirSync, rmSync } from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import EmbeddedPostgres from 'embedded-postgres'

// La base vive acá adentro del proyecto, así no ensucia la máquina y se borra
// tirando la carpeta. Está en .gitignore.
const CARPETA_DE_DATOS = path.join(process.cwd(), '.postgres')
const ARCHIVO_DE_LOCK = path.join(CARPETA_DE_DATOS, 'postmaster.pid')

// No el 5432: si quien lo corre ya tiene PostgreSQL instalado, ese puerto está
// ocupado y el arranque fallaría.
const PUERTO = 54329

const NOMBRE_DE_BASE = 'tocayjuga'
const DATABASE_URL = `postgresql://postgres:postgres@localhost:${PUERTO}/${NOMBRE_DE_BASE}`

// Firma las cookies de sesión. Es un valor de demo a propósito: la base y la
// app corren solo en esta máquina y se tiran al cerrar.
const AUTH_SECRET = 'secreto-de-demo-para-correr-el-proyecto-en-local'

// Se le pasa a los procesos hijos. Next y la CLI de Prisma respetan las
// variables que ya vienen seteadas, así que esto le gana a cualquier .env que
// haya en la carpeta: el demo siempre usa su propia base.
const entorno = { ...process.env, DATABASE_URL, AUTH_SECRET }

// start() del paquete rechaza sin decir por qué: lo único que explica una falla
// son los mensajes que Postgres escribe en stderr, así que se guardan.
const mensajesDePostgres: string[] = []

const postgres = new EmbeddedPostgres({
  databaseDir: CARPETA_DE_DATOS,
  port: PUERTO,
  user: 'postgres',
  password: 'postgres',
  persistent: true,
  // En Windows los binarios vienen con symlinks que npm a veces no restaura
  autoRehydrateSymlinks: true,
  onLog: (mensaje) => {
    mensajesDePostgres.push(mensaje.trim())
    if (mensajesDePostgres.length > 15) mensajesDePostgres.shift()
  },
})

function paso(texto: string) {
  console.log(`\n▸ ${texto}`)
}

// ---------- Dejar el puerto libre antes de arrancar ----------
//
// Postgres corre como un proceso aparte que NO es hijo de node: si se cierra la
// terminal de golpe, queda vivo y bloquea el próximo arranque. Pasa seguido, y
// el error que tira el paquete en ese caso no se entiende, así que se maneja acá.

// ¿Hay algo escuchando en el puerto? Es la única forma confiable de saberlo.
function hayAlgoEscuchando(): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port: PUERTO })
    const responder = (hay: boolean) => {
      socket.destroy()
      resolve(hay)
    }
    socket.setTimeout(1000)
    socket.on('connect', () => responder(true))
    socket.on('error', () => responder(false))
    socket.on('timeout', () => responder(false))
  })
}

// pg_ctl es la herramienta de Postgres para apagar un cluster. Viene con los
// binarios que bajó npm. Es lo ÚNICO que sirve: matar el proceso del postmaster
// a mano deja a sus procesos hijos vivos, y esos siguen con el puerto tomado.
function rutaDePgCtl(): string {
  const carpeta = path.join(process.cwd(), 'node_modules', '@embedded-postgres')
  // npm instala solo el paquete de la plataforma actual, así que hay una sola
  const plataforma = readdirSync(carpeta)[0]
  const ejecutable = process.platform === 'win32' ? 'pg_ctl.exe' : 'pg_ctl'
  return path.join(carpeta, plataforma, 'native', 'bin', ejecutable)
}

// Corre un comando sin mostrar nada y sin importar si falla.
function correrSilencioso(comando: string): Promise<void> {
  return new Promise((resolve) => {
    const proceso = spawn(comando, { shell: true, stdio: 'ignore', env: entorno })
    proceso.on('exit', () => resolve())
    proceso.on('error', () => resolve())
  })
}

function esperarAQueSeLibereElPuerto(): Promise<void> {
  return new Promise((resolve, reject) => {
    let intentos = 0
    const revisar = async () => {
      if (!(await hayAlgoEscuchando())) return resolve()
      intentos++
      if (intentos > 60) {
        return reject(new Error(`El puerto ${PUERTO} sigue ocupado después de 30 segundos.`))
      }
      setTimeout(revisar, 500)
    }
    void revisar()
  })
}

async function dejarListoElPuerto() {
  // El archivo de lock existe mientras haya (o haya habido) un cluster en esta
  // carpeta. Si está, se intenta apagarlo prolijamente antes de arrancar.
  if (existsSync(ARCHIVO_DE_LOCK)) {
    console.log('  (quedó un Postgres de una corrida anterior: se apaga)')
    await correrSilencioso(`"${rutaDePgCtl()}" stop -D "${CARPETA_DE_DATOS}" -m immediate -w -t 30`)
    // Si no había servidor corriendo, pg_ctl no borra nada y el archivo sobra.
    rmSync(ARCHIVO_DE_LOCK, { force: true })
    await esperarAQueSeLibereElPuerto()
  }

  if (await hayAlgoEscuchando()) {
    throw new Error(
      `El puerto ${PUERTO} está ocupado por otro programa.
` + `Cerralo, o cambiá la constante PUERTO en scripts/demo.ts.`,
    )
  }
}

// ---------- Arranque ----------

// Corre un comando y espera a que termine. Si falla, corta todo.
function correr(comando: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proceso = spawn(comando, { shell: true, stdio: 'inherit', env: entorno })
    proceso.on('exit', (codigo) => {
      if (codigo === 0) resolve()
      else reject(new Error(`"${comando}" terminó con código ${codigo}`))
    })
  })
}

async function laBaseEstaVacia(): Promise<boolean> {
  const cliente = postgres.getPgClient(NOMBRE_DE_BASE)
  await cliente.connect()
  try {
    const { rows } = await cliente.query('select count(*)::int as cuantos from "Usuario"')
    return rows[0].cuantos === 0
  } finally {
    await cliente.end()
  }
}

async function main() {
  // initialise() solo la primera vez: deja la carpeta de datos lista. Si ya
  // existe, volver a correrlo tira error.
  if (!existsSync(CARPETA_DE_DATOS)) {
    paso('Preparando la base de datos por primera vez (tarda unos segundos)...')
    await postgres.initialise()
  }

  paso(`Arrancando PostgreSQL en el puerto ${PUERTO}...`)
  await dejarListoElPuerto()
  await postgres.start()

  // Falla si la base ya existe, que es lo normal de la segunda vez en adelante
  try {
    await postgres.createDatabase(NOMBRE_DE_BASE)
  } catch {
    // ya estaba creada
  }

  paso('Aplicando las migraciones...')
  await correr('npx prisma migrate deploy')

  if (await laBaseEstaVacia()) {
    paso('Cargando los datos de demo...')
    await correr('npx tsx prisma/seed.ts')
  } else {
    paso('La base ya tiene datos: no se vuelve a cargar el seed.')
    console.log('  (para empezar de cero: borrá la carpeta .postgres y corré esto otra vez)')
  }

  paso('Levantando la aplicación...')
  console.log(`
  La dirección para abrir en el navegador la imprime Next acá abajo
  (normalmente http://localhost:3000).

  Para entrar:
    Jugador   jugador@demo.com     Jugador1234
    Dueño     admin@demo.com       Admin1234
    Admin     admin@tocayjuga.com  Admin1234

  Ctrl+C para cortar (apaga también la base).
`)

  const next = spawn('npx next dev', { shell: true, stdio: 'inherit', env: entorno })

  // Si se corta Next, se apaga la base; si se corta con Ctrl+C, se apagan los dos.
  next.on('exit', () => void apagar())
  process.on('SIGINT', () => void apagar())
  process.on('SIGTERM', () => void apagar())
}

let apagando = false

async function apagar() {
  if (apagando) return
  apagando = true
  console.log('\n▸ Apagando la base de datos...')
  try {
    await postgres.stop()
  } catch {
    // si ya estaba apagada, no importa
  }
}

main().catch(async (error) => {
  console.error('\n✖ No se pudo levantar el proyecto.\n')

  // El paquete rechaza con undefined cuando Postgres no arranca: ahí lo único
  // que sirve son sus propios mensajes.
  if (error instanceof Error) {
    console.error(error.message)
  } else if (mensajesDePostgres.length > 0) {
    console.error('Postgres dijo:\n')
    console.error(mensajesDePostgres.join('\n'))
    console.error('\nSi no se entiende: borrá la carpeta .postgres y volvé a correr npm run demo.')
  } else {
    console.error(error)
  }

  await postgres.stop().catch(() => {})
  process.exitCode = 1
})
