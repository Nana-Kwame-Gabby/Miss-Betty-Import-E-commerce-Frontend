const http = require('http');
const https = require('https');
const fs = require('fs');

const env = {};
if (fs.existsSync('/etc/hubtel-proxy.env')) {
  fs.readFileSync('/etc/hubtel-proxy.env', 'utf8').split('\n').forEach(l => {
    const i = l.indexOf('=');
    if (i > 0) env[l.slice(0, i).trim()] = l.slice(i + 1).trim();
  });
}

const SECRET   = env.PROXY_SECRET || '';
const KEY      = env.HUBTEL_API_KEY || '';
const ID       = env.HUBTEL_API_ID || '';
const MERCHANT = env.HUBTEL_MERCHANT_ACCOUNT || '';
const PORT     = parseInt(env.PORT || '3000');
const AUTH     = 'Basic ' + Buffer.from(ID + ':' + KEY).toString('base64');

function hubtelRequest(opt, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(opt, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function readBody(req) {
  let b = '';
  for await (const c of req) b += c;
  return b;
}

http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.headers['x-proxy-key'] !== SECRET) {
    res.writeHead(401);
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }

  const u = new URL(req.url, 'http://localhost');
  try {
    if (req.method === 'POST' && u.pathname === '/initiate') {
      const body = await readBody(req);
      const r = await hubtelRequest({
        hostname: 'payproxyapi.hubtel.com',
        path: '/items/initiate',
        method: 'POST',
        headers: { 'Authorization': AUTH, 'Content-Type': 'application/json' },
      }, body);
      res.writeHead(r.status);
      res.end(r.body);

    } else if (req.method === 'GET' && u.pathname === '/status') {
      const ref = u.searchParams.get('clientReference') || '';
      const r = await hubtelRequest({
        hostname: 'rmsc.hubtel.com',
        path: '/v1/merchantaccount/merchants/' + MERCHANT + '/transactions/status?clientReference=' + encodeURIComponent(ref),
        method: 'GET',
        headers: { 'Authorization': AUTH, 'Content-Type': 'application/json' },
      });
      res.writeHead(r.status);
      res.end(r.body);

    } else {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  } catch (err) {
    console.error('Proxy error:', err.message);
    res.writeHead(502);
    res.end(JSON.stringify({ error: 'Proxy error: ' + err.message }));
  }
}).listen(PORT, '0.0.0.0', () => console.log('Hubtel proxy on port ' + PORT));
