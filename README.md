# TocaYJuga

Marketplace de reservas de canchas de fútbol. Junta canchas de distintos complejos en un solo lugar para buscar, comparar y reservar.

Proyecto de la materia PID — UCA.

## Stack

- Next.js 16 (App Router) — frontend + backend en el mismo proyecto
- TypeScript strict
- PostgreSQL + Prisma 7 (driver adapter `@prisma/adapter-pg`)
- Auth.js (NextAuth) — roles Jugador / Dueño
- Tailwind + shadcn/ui
- Vercel Blob para imágenes

## Ejecutarlo sin configurar nada

Requisitos: Node 22+ e internet para el `npm install`.

```bash
npm install
npm run demo
```

Levanta un PostgreSQL propio del proyecto (binarios que baja npm, datos en
`.postgres/`), aplica las migraciones, carga los datos de demo y arranca la app.
No instala nada en el sistema ni pisa un Postgres que ya tengas. `Ctrl+C` corta
todo. Detalle completo y usuarios de prueba en [COMO-EJECUTAR.md](COMO-EJECUTAR.md).

## Setup para desarrollar

```bash
npm install
cp .env.example .env          # completar DATABASE_URL y AUTH_SECRET
npm run db:migrate            # aplica migraciones a la DB
npm run db:seed               # datos de demo (ojo: borra todo lo que haya)
npm run dev                   # http://localhost:3000
```

Para `DATABASE_URL` sirve cualquier Postgres: uno instalado en la máquina, o un
string de Neon/Supabase. Generá el `AUTH_SECRET` con
`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.

> `npm run db:dev` (`prisma dev`) **no sirve** para este proyecto: es PGlite y su
> puerto TCP resetea las conexiones de `pg`, que es el driver que usa
> `lib/db.ts`. Si no querés instalar Postgres, usá `npm run demo`.

## Scripts

| Comando                    | Qué hace                                       |
| -------------------------- | ---------------------------------------------- |
| `npm run demo`             | Todo junto sin configurar nada (ver arriba)    |
| `npm run dev`              | Servidor de desarrollo                         |
| `npm run build`            | Build de producción                            |
| `npm run lint`             | ESLint                                         |
| `npm run format`           | Prettier (escribe)                             |
| `npm run typecheck`        | `tsc --noEmit`                                 |
| `npm run db:dev`           | Postgres local sin Docker (`prisma dev`)       |
| `npm run db:migrate`       | Crear/aplicar migración                        |
| `npm run db:seed`          | Carga datos de demo (borra todo antes)         |
| `npm run db:studio`        | GUI de la base (Prisma Studio)                 |
| `npm run test`             | Corre los tests de lib/                        |
| `npm run test:integration` | Corre los tests de tests/ escribiendo en la DB |

## Convenciones

- Ramas: `main` (demo) · `develop` (integración) · `feature/UCA-XX-slug`
- La key del ticket en el nombre de rama linkea el PR a Jira
- Todo PR con review de otro integrante antes de mergear
- Lógica de negocio en `lib/services/`, validación en `lib/validations/`, acceso a DB solo vía `lib/db.ts`

## Documentación

- [COMO-EJECUTAR.md](COMO-EJECUTAR.md) — cómo levantarlo y usuarios de prueba
- [CLAUDE.md](CLAUDE.md) — convenciones del equipo
- Tickets y planes de sprint: en Jira (`docs/` es local y no se pushea)
