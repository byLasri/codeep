import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { Proxy } from 'http-mitm-proxy';

const PROXY_PORT = Number(process.env.PROXY_PORT ?? 8080);
const TARGET_HOST = 'chat.deepseek.com';
const OUTPUT_DIR = join(__dirname, '..');
const HEX_FILE = join(OUTPUT_DIR, 'captured-request.hex');
const JSON_FILE = join(OUTPUT_DIR, 'captured-request.json');
const CERT_DIR = join(OUTPUT_DIR, '.http-mitm-proxy');

if (!existsSync(CERT_DIR)) {
  mkdirSync(CERT_DIR, { recursive: true });
}

const proxy = new Proxy();

function isTargetRequest(host: string | undefined): boolean {
  return host?.split(':')[0].toLowerCase() === TARGET_HOST;
}

function saveCapture(ctx: Parameters<NonNullable<Parameters<typeof proxy.onRequest>[0]>>[0], body: Buffer): void {
  const request = ctx.clientToProxyRequest;
  const headers = { ...request.headers };

  for (const header of ['authorization', 'cookie', 'set-cookie', 'x-ds-pow-response']) {
    if (header in headers) {
      headers[header] = '[REDACTED]';
    }
  }

  writeFileSync(HEX_FILE, body.toString('hex'), 'utf8');
  writeFileSync(
    JSON_FILE,
    JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        url: `https://${TARGET_HOST}${request.url ?? ''}`,
        method: request.method,
        headers,
        bodyUtf8: body.toString('utf8'),
        bodyHex: body.toString('hex'),
        bodyLength: body.length,
      },
      null,
      2,
    ),
    'utf8',
  );

  console.log(`Captured ${request.method ?? 'UNKNOWN'} ${request.url ?? '/'}`);
  console.log(`  raw bytes: ${HEX_FILE}`);
  console.log(`  JSON:      ${JSON_FILE}`);
}

proxy.onRequest((ctx, callback) => {
  const request = ctx.clientToProxyRequest;
  if (!isTargetRequest(request.headers.host) || request.method !== 'POST') {
    callback();
    return;
  }

  const chunks: Buffer[] = [];
  ctx.onRequestData((requestContext, chunk, dataCallback) => {
    chunks.push(chunk);
    dataCallback(null, chunk);
  });
  ctx.onRequestEnd((requestContext, endCallback) => {
    saveCapture(requestContext, Buffer.concat(chunks));
    endCallback();
  });
  callback();
});

proxy.onError((ctx, error, errorKind) => {
  const url = ctx?.clientToProxyRequest?.url ?? '<unknown>';
  console.error(`${errorKind} for ${url}: ${error?.message ?? 'unknown error'}`);
});

proxy.listen({ host: '127.0.0.1', port: PROXY_PORT, sslCaDir: CERT_DIR }, (error) => {
  if (error) {
    console.error(`Unable to start proxy: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Proxy listening on http://127.0.0.1:${PROXY_PORT}`);
  console.log(`Capturing POST requests for https://${TARGET_HOST}`);
  console.log('Install/trust the generated local CA in the browser before using HTTPS interception.');
  console.log('Press Ctrl+C to stop.');
});

process.once('SIGINT', () => {
  proxy.close();
});
