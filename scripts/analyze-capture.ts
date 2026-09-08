import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const captureFile = process.argv[2] ?? join(__dirname, '..', 'captured-request.json');

if (!existsSync(captureFile)) {
  console.error(`Capture file not found: ${captureFile}`);
  process.exitCode = 1;
} else {
  const capture: {
    capturedAt?: string;
    url?: string;
    method?: string;
    headers?: Record<string, string | string[] | undefined>;
    bodyUtf8?: string;
    bodyHex?: string;
    bodyLength?: number;
  } = JSON.parse(readFileSync(captureFile, 'utf8'));

  console.log(`Captured at: ${capture.capturedAt ?? 'unknown'}`);
  console.log(`Request:     ${capture.method ?? 'unknown'} ${capture.url ?? 'unknown'}`);
  console.log(`Body bytes:  ${capture.bodyLength ?? Buffer.from(capture.bodyHex ?? '', 'hex').length}`);
  console.log('Headers:');

  for (const [name, value] of Object.entries(capture.headers ?? {})) {
    console.log(`  ${name}: ${Array.isArray(value) ? value.join(', ') : value ?? ''}`);
  }

  if (capture.bodyUtf8) {
    try {
      console.log('Body JSON:');
      console.log(JSON.stringify(JSON.parse(capture.bodyUtf8), null, 2));
    } catch {
      console.log('Body is not valid JSON.');
    }
  }
}
