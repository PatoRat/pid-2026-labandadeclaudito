import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    // Las fotos que se suben en este fork van a public/uploads/ y se piden con
    // un path relativo (/uploads/...), que no necesita remotePattern.
    remotePatterns: [
      // Fotos de demo del seed (prisma/seed.ts)
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
}

export default nextConfig
