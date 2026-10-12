const http = require('http');
const request = require('../src/request');

// Starts `server` on a random port and resolves with that port.
function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

function close(server) {
  server.closeAllConnections?.();
  return new Promise((resolve) => server.close(resolve));
}

describe('request', () => {
  let origin, originPort, proxy, proxyPort, proxiedUrls, pacScript;

  beforeEach(async () => {
    // The origin also serves the PAC file, which tests set via `pacScript`.
    // (proxy-agent 5 can't load PAC scripts from `pac+data:` URLs.)
    pacScript = null;
    origin = http.createServer((req, res) => {
      if (req.url === '/proxy.pac') {
        res.writeHead(200, { 'Content-Type': 'application/x-ns-proxy-autoconfig' });
        res.end(pacScript);
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('hello from origin');
    });
    originPort = await listen(origin);

    // A minimal forward proxy that records each URL it relays.
    proxiedUrls = [];
    proxy = http.createServer((req, res) => {
      proxiedUrls.push(req.url);
      const upstream = http.request(req.url, { method: req.method, headers: req.headers }, (upstreamRes) => {
        res.writeHead(upstreamRes.statusCode, upstreamRes.headers);
        upstreamRes.pipe(res);
      });
      upstream.on('error', () => {
        res.writeHead(502);
        res.end();
      });
      req.pipe(upstream);
    });
    proxyPort = await listen(proxy);
  });

  afterEach(async () => {
    await close(origin);
    await close(proxy);
  });

  describe('when a proxy is configured', () => {
    it('routes requests through an HTTP proxy', async () => {
      const url = `http://127.0.0.1:${originPort}/hello`;
      const res = await request.get({ url, proxy: `http://127.0.0.1:${proxyPort}` });

      expect(res.text).toBe('hello from origin');
      expect(proxiedUrls).toEqual([url]);
    });

    it('routes requests through the proxy named by a PAC script', async () => {
      const url = `http://127.0.0.1:${originPort}/hello`;
      pacScript = `function FindProxyForURL(url, host) { return "PROXY 127.0.0.1:${proxyPort}"; }`;
      const res = await request.get({ url, proxy: `pac+http://127.0.0.1:${originPort}/proxy.pac` });

      expect(res.text).toBe('hello from origin');
      expect(proxiedUrls).toEqual([url]);
    });

    it('connects directly when a PAC script returns DIRECT', async () => {
      const url = `http://127.0.0.1:${originPort}/hello`;
      pacScript = 'function FindProxyForURL(url, host) { return "DIRECT"; }';
      const res = await request.get({ url, proxy: `pac+http://127.0.0.1:${originPort}/proxy.pac` });

      expect(res.text).toBe('hello from origin');
      expect(proxiedUrls).toEqual([]);
    });
  });
});
