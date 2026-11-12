import 'dotenv/config'
import { vi } from 'vitest'

// auth() real necesita cookies y NextAuth: se reemplaza por uno que devuelve
// la sesión que eligió el test.
vi.mock('@/auth', async () => {
  const sesion = await import('./sesion')
  return {
    auth: async () => sesion.obtenerSesion(),
  }
})

// No escribir ni borrar archivos reales en public/uploads/.
vi.mock('@/lib/archivos', () => {
  return {
    guardarArchivo: vi.fn(async (carpeta: string) => {
      return `/uploads/${carpeta}/foto-de-test.png`
    }),
    borrarArchivo: vi.fn(async () => {}),
  }
})
