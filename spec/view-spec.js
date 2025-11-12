const path = require('path');
const express = require('express');
const http = require('http');

describe('apm view', () => {
  let server = null;

  beforeEach(async () => {
    silenceOutput();
    spyOnToken();

    const app = express();
    app.get('/wrap-guide', (_request, response) => {
      response.sendFile(path.join(__dirname, 'fixtures', 'wrap-guide.json'));
    });
    server = http.createServer(app);

    await new Promise((resolve) => {
      server.listen(3000, '127.0.0.1', () => {
        process.env.ATOM_PACKAGES_URL = 'http://localhost:3000';
        resolve();
      });
    });
  });

  afterEach(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it('displays information about the package', async () => {
    await apmRun(['view', 'wrap-guide']);

    expect(console.log).toHaveBeenCalled();
    expect(console.log.calls.argsFor(0)[0]).toContain('wrap-guide');
    expect(console.log.calls.argsFor(1)[0]).toContain('0.14.0');
    expect(console.log.calls.argsFor(2)[0]).toContain('https://github.com/atom/wrap-guide');
    expect(console.log.calls.argsFor(3)[0]).toContain('new version');
  });

  it('logs an error if the package name is missing or empty', async () => {
    await apmRun(['view']);

    expect(console.error).toHaveBeenCalled();
    expect(console.error.calls.argsFor(0)[0].length).toBeGreaterThan(0);
  });

  describe('when a compatible Atom version is specified', () => {
    it('displays the latest compatible version of the package', async () => {
      await apmRun(['view', 'wrap-guide', '--compatible', '1.5.0']);

      expect(console.log.calls.argsFor(0)[0]).toContain('wrap-guide');
      expect(console.log.calls.argsFor(1)[0]).toContain('0.3.0');
      expect(console.log.calls.argsFor(2)[0]).toContain('https://github.com/atom2/wrap-guide');
      expect(console.log.calls.argsFor(3)[0]).toContain('old version');
    });
  });
});
