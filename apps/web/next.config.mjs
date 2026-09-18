import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Pull a few settings from the repository-root .env.
 *
 * Next only reads .env files inside its own project directory (apps/web), so
 * anything in the root .env is invisible to it. That is a quiet trap: the site
 * verification tags are configured in the root .env like everything else, the
 * build succeeds, and the tags simply never appear in the HTML — which is
 * exactly what happened, and is only noticeable if you go and look.
 *
 * Rather than ask people to maintain two env files, the handful of keys the web
 * tier needs are read from the root here. Deliberately an ALLOWLIST: loading the
 * whole file would put the database password and JWT secret into this process
 * for no reason. Existing environment variables always win.
 */
const ROOT_ENV_KEYS = [
  'NEXT_PUBLIC_SITE_URL',
  'INTERNAL_API_URL',
  'GOOGLE_SITE_VERIFICATION',
  'BING_SITE_VERIFICATION',
];

const rootEnvPath = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.env');
if (existsSync(rootEnvPath)) {
  for (const line of readFileSync(rootEnvPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (!ROOT_ENV_KEYS.includes(key)) continue;
    if (process.env[key]) continue;
    const value = rawValue.trim().replace(/^["']|["']$/g, '');
    if (value) process.env[key] = value;
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // NOTE: `output: 'standalone'` is deliberately NOT set.
  //
  // It emits a self-contained bundle that uses less memory, which is tempting on
  // a 4 GB box — but it is served by `node .next/standalone/server.js`, not by
  // `next start`, and it needs .next/static and public/ copied in by hand after
  // every build. Leaving it set while running `next start` meant Next printed
  // "does not work with output: standalone" on every boot and silently ignored
  // it. A config option that is ignored is worse than one that is absent.
  //
  // Revisit if memory gets tight: the saving is real, the extra build step is
  // the price.

  poweredByHeader: false,
  compress: true,

  eslint: { ignoreDuringBuilds: false },
  typescript: { ignoreBuildErrors: false },

  images: {
    // Generated media is served by the API behind an ownership check, so the
    // optimizer must be allowed to read from our own origin only.
    remotePatterns: [],
    formats: ['image/webp'],
  },

  // Without this, /api/* falls through to Next's own 404 whenever nginx is not
  // in front of the app — which is the case on localhost and before the domain
  // is live. Behind nginx the proxy never reaches Next, so this stays inert.
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.INTERNAL_API_URL ?? 'http://127.0.0.1:8010'}/api/:path*`,
      },
    ];
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
