import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';
import * as tls from 'tls';

const PROXY_PORT = 8080;
const TARGET_HOST = 'chat.deepseek.com';
const OUTPUT_DIR = path.join(__dirname, '..', 'captured');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

console.log('🔍 DeepSeek MITM Proxy Starter');
console.log('================================');
console.log(`Target: ${TARGET_HOST}`);
console.log(`Output: ${OUTPUT_DIR}`);
console.log('');
console.log('INSTRUCTIONS:');
console.log('1. Configure your browser to use proxy: http://localhost:' + PROXY_PORT);
console.log('2. Visit https://chat.deepseek.com and log in');
console.log('3. Send a chat message to capture the full request');
console.log('4. Check the "captured" folder for request data');
console.log('');
console.log('Starting proxy server...');

// Simple HTTP proxy that intercepts requests to chat.deepseek.com
const proxy = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url || '', `http://${req.headers.host}`);
  
  if (parsedUrl.hostname === TARGET_HOST && req.method === 'POST') {
    console.log(`\n📩 Intercepting request: ${parsedUrl.pathname}`);
    
    let requestBody = Buffer.alloc(0);
    
    req.on('data', (chunk) => {
      requestBody = Buffer.concat([requestBody, chunk]);
    });
    
    req.on('end', () => {
      // Save raw request bytes as hex
      const hexFile = path.join(OUTPUT_DIR, `request-${Date.now()}.hex`);
      fs.writeFileSync(hexFile, requestBody.toString('hex'));
      console.log(`💾 Saved raw bytes to: ${hexFile}`);
      
      // Save as JSON for easier analysis
      const jsonFile = path.join(OUTPUT_DIR, `request-${Date.now()}.json`);
      const requestData = {
        url: parsedUrl.href,
        method: req.method,
        headers: req.headers,
        body: requestBody.toString('utf-8'),
        bodyHex: requestBody.toString('hex'),
        bodyLength: requestBody.length,
        timestamp: new Date().toISOString()
      };
      fs.writeFileSync(jsonFile, JSON.stringify(requestData, null, 2));
      console.log(`💾 Saved JSON to: ${jsonFile}`);
      
      // Log key info
      console.log('📊 Request Summary:');
      console.log(`   Path: ${parsedUrl.pathname}`);
      console.log(`   Body Length: ${requestBody.length} bytes`);
      if (req.headers['x-ds-pow-response']) {
        console.log(`   PoW Response: ${String(req.headers['x-ds-pow-response']).substring(0, 50)}...`);
      }
      console.log('');
    });
  }
  
  // Forward request to target
  const targetUrl = `https://${TARGET_HOST}${parsedUrl.pathname}${parsedUrl.search}`;
  const options = {
    hostname: TARGET_HOST,
    port: 443,
    path: parsedUrl.pathname + parsedUrl.search,
    method: req.method,
    headers: {
      ...req.headers,
      host: TARGET_HOST
    }
  };
  
  const proxyReq = https.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
    proxyRes.pipe(res);
  });
  
  proxyReq.on('error', (e) => {
    console.error('Proxy request error:', e.message);
    res.writeHead(500);
    res.end('Proxy error');
  });
  
  req.pipe(proxyReq);
});

proxy.on('connect', (req, clientSocket, head) => {
  // Handle HTTPS CONNECT
  const parsedUrl = new URL(`http://${req.url}`);
  
  if (parsedUrl.hostname === TARGET_HOST) {
    console.log(`🔗 CONNECT to ${TARGET_HOST}`);
  }
  
  const proxySocket = tls.connect({
    port: 443,
    host: parsedUrl.hostname
  }, () => {
    clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
    clientSocket.pipe(proxySocket);
    proxySocket.pipe(clientSocket);
  });
  
  proxySocket.on('error', (e) => {
    console.error('TLS connection error:', e.message);
  });
});

proxy.listen(PROXY_PORT, () => {
  console.log(`✅ Proxy listening on port ${PROXY_PORT}`);
  console.log('');
  console.log('⚠️  NOTE: This is a simple proxy. For full HTTPS interception with certificate,');
  console.log('    you may need to use tools like mitmproxy or Fiddler.');
  console.log('');
  console.log('Waiting for requests... (Ctrl+C to stop)');
});

process.on('SIGINT', () => {
  console.log('\n\n🛑 Stopping proxy...');
  proxy.close(() => {
    console.log('Proxy stopped.');
    process.exit(0);
  });
});
