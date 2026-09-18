/**
 * Pickixo web server, over HTTPS.
 *
 *   node server.mjs          production (needs `next build` first)
 *   node server.mjs --dev    development, with hot reload
 *
 * Why a custom server rather than `next start`: Next has no way to serve HTTPS
 * from `next start`, and `next dev --experimental-https` is dev-only and wants
 * to download mkcert. Twelve lines of node:https avoids both.
 *
 * WHERE THIS BELONGS IN THE ARCHITECTURE
 *
 * This terminates TLS in Node, which is the right thing for local development
 * and the wrong thing for production. In production nginx should hold the real
 * certificate and proxy plaintext to this process on loopback — that is why the
 * API is deliberately left on plain HTTP over 127.0.0.1 rather than given its
 * own certificate. Loopback traffic never touches a network; adding TLS to it
 * buys nothing and costs a second certificate to keep valid.
 *
 * So the trust boundary is: browser ⇄ HTTPS ⇄ (this process | nginx) ⇄ loopback.
 */
import { createServer } from 'node:https';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import next from 'next';

const here = dirname(fileURLToPath(import.meta.url));
const dev = process.argv.includes('--dev');
const port = Number(process.env.PORT ?? 3010);
const hostname = process.env.HOSTNAME ?? 'localhost';

const certDir = join(here, 'certs');
const keyPath = join(certDir, 'localhost.key');
const crtPath = join(certDir, 'localhost.crt');

if (!existsSync(keyPath) || !existsSync(crtPath)) {
  // Fail loudly with the fix, rather than silently falling back to HTTP. A
  // server that quietly stops being encrypted is worse than one that refuses
  // to start.
  console.error(
    '\n  No TLS certificate found.\n\n' +
    `  Expected:\n    ${crtPath}\n    ${keyPath}\n\n` +
    '  Generate one with:\n    bash scripts/make-dev-cert.sh\n',
  );
  process.exit(1);
}

const app = next({ dev, dir: here });
const handle = app.getRequestHandler();

await app.prepare();

createServer(
  {
    key: readFileSync(keyPath),
    cert: readFileSync(crtPath),
    // TLS 1.2 is the floor. Everything below it is broken, and nothing that
    // matters still needs it.
    minVersion: 'TLSv1.2',
  },
  (req, res) => {
    // Tells Next it is behind TLS, so absolute URLs and redirects it generates
    // use https rather than http.
    req.headers['x-forwarded-proto'] = 'https';
    // No pre-parsed URL: Next parses it itself with the WHATWG URL API. Passing
    // url.parse() output here works but is deprecated, and its quirks have had
    // security implications.
    handle(req, res);
  },
)
  .on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n  Port ${port} is already in use.\n`);
      process.exit(1);
    }
    throw err;
  })
  .listen(port, () => {
    console.log(
      `\n  Pickixo ${dev ? 'dev' : 'production'} server\n` +
      `  https://${hostname}:${port}\n\n` +
      '  The certificate is self-signed, so the browser will warn once.\n',
    );
  });
