# Cómo ejecutar TocaYJuga

El proyecto usa **PostgreSQL**. Hay dos formas de levantarlo; las dos dejan la
aplicación funcionando igual, con los mismos datos de demo.

**Requisitos comunes:** Node.js 22 o más nuevo, y conexión a internet para el
`npm install`.

---

## Opción 1 — Con PostgreSQL ya instalado

Si tenés (o querés instalar) PostgreSQL en la máquina. Son cuatro pasos.

**1.** Instalar PostgreSQL 17 si no lo tenés:

| Sistema         | Comando                                                           |
| --------------- | ----------------------------------------------------------------- |
| Windows         | `winget install PostgreSQL.PostgreSQL.17`                         |
| macOS           | `brew install postgresql@17 && brew services start postgresql@17` |
| Ubuntu / Debian | `sudo apt install postgresql`                                     |

En Windows queda como servicio y arranca solo. El instalador pide una
contraseña para el usuario `postgres`: anotala, va en el paso 3.

**2.** Crear la base (vacía):

```bash
# En Windows psql no entra al PATH solo: vive en C:\Program Files\PostgreSQL\17\bin
psql -U postgres -c "CREATE DATABASE tocayjuga;"
```

**3.** Crear el archivo `.env` en la raíz del proyecto, con estas dos líneas
(cambiando `TU_CONTRASEÑA` por la del paso 1):

```
DATABASE_URL="postgresql://postgres:TU_CONTRASEÑA@localhost:5432/tocayjuga"
AUTH_SECRET="cualquier-texto-largo-para-firmar-las-sesiones"
```

**4.** Instalar, crear las tablas, cargar los datos y arrancar:

```bash
npm install
npx prisma migrate deploy    # crea las tablas (aplica las 27 migraciones)
npm run db:seed              # carga los datos de demo
npm run dev                  # http://localhost:3000
```

De ahí en adelante, para volver a levantarlo alcanza con `npm run dev`.

---

## Opción 2 — Sin instalar nada

Si preferís no instalar PostgreSQL en la máquina:

```bash
npm install
npm run demo
```

Y abrir la dirección que imprime la consola (normalmente
http://localhost:3000). `Ctrl+C` corta todo.

`npm run demo` levanta un PostgreSQL **propio del proyecto** y hace los cuatro
pasos de la Opción 1 por su cuenta. Los binarios de Postgres los bajó el
`npm install` (paquete `embedded-postgres`) y los datos quedan en la carpeta
`.postgres/` de este mismo directorio: **no se instala nada en el sistema**, no
toca un PostgreSQL que ya tengas (usa el puerto 54329, no el 5432) y se borra
tirando la carpeta.

Es el mismo PostgreSQL, el mismo esquema y las mismas migraciones que la
Opción 1 — solo cambia quién arranca el servidor.

La segunda vez es más rápido: detecta que la base ya tiene datos y no vuelve a
cargarlos. Para empezar de cero, borrá `.postgres/` y corré `npm run demo` otra
vez.

---

## Usuarios para entrar

La aplicación arranca con datos de demo ya cargados.

| Rol                | Email                 | Contraseña    |
| ------------------ | --------------------- | ------------- |
| Jugador            | `jugador@demo.com`    | `Jugador1234` |
| Jugador            | `jugador@dev.com`     | `Jugador1234` |
| Dueño de complejos | `admin@demo.com`      | `Admin1234`   |
| Dueño de complejos | `admin@dev.com`       | `Admin1234`   |
| Administrador      | `admin@tocayjuga.com` | `Admin1234`   |

`jugador@demo.com` tiene una reserva de cada estado posible (próxima, en curso,
jugada, cancelada, pendiente de seña), así que es el mejor para recorrer la app.
Las fechas se calculan al cargar los datos, así que siempre hay turnos pasados,
actuales y futuros.

---

## Ver la base de datos

```bash
npm run db:studio          # Opción 1 (usa el .env)
```

Con la Opción 2, mientras `npm run demo` corre, en otra terminal:

```bash
npx prisma studio --url "postgresql://postgres:postgres@localhost:54329/tocayjuga"
```

---

## Correr los tests

```bash
npm test                  # 416 tests de lógica, no necesitan base de datos
npm run test:integration  # 219 tests que llaman a los endpoints contra la base
```

Los de integración necesitan una base. Con `npm run demo` corriendo en otra
terminal:

```bash
# Windows (PowerShell)
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:54329/tocayjuga"; $env:AUTH_SECRET="test"; npm run test:integration

# macOS / Linux
DATABASE_URL="postgresql://postgres:postgres@localhost:54329/tocayjuga" AUTH_SECRET="test" npm run test:integration
```

---

## Si algo falla

| Síntoma                                          | Qué pasa                                  | Solución                                                        |
| ------------------------------------------------ | ----------------------------------------- | --------------------------------------------------------------- |
| `El puerto 54329 está ocupado por otro programa` | hay otra cosa escuchando ahí              | cerrala, o cambiá la constante `PUERTO` en `scripts/demo.ts`    |
| `quedó un Postgres de una corrida anterior`      | se cerró la terminal sin `Ctrl+C`         | no es un error: el script lo apaga y sigue solo                 |
| El navegador no abre en el puerto 3000           | el 3000 estaba ocupado                    | Next elige otro y lo imprime en la consola; usá ese             |
| Algo raro con la base                            | quedó en un estado inconsistente          | borrá la carpeta `.postgres/` y corré `npm run demo` de nuevo   |
| `npm install` falla compilando                   | falta un compilador para un módulo nativo | con Node 22 o 24 no debería pasar; probá `npm install` otra vez |

---

## Notas sobre el proyecto

- Es un marketplace de reservas de canchas (Next.js 16 + PostgreSQL + Prisma 7).
- **Los pagos son simulados**, por consigna de la materia. La "seña" no cobra
  nada: solo registra el pago en la base.
- Las fotos que se suben desde la aplicación se guardan en `public/uploads/`.
  En el entorno de producción del equipo esto usa un servicio de archivos
  (Vercel Blob); acá se usa el disco para que funcione sin credenciales.
- **El esquema de la base es el mismo en las dos opciones**: `prisma/schema.prisma`
  y las 27 migraciones no cambian según cómo se levante el servidor. Es
  PostgreSQL en los dos casos.
