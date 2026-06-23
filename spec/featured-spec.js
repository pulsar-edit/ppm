const path = require('path');
const express = require('express');
const http = require('http');

describe('apm featured', () => {
  let server = null;

  beforeEach(async () => {
    silenceOutput();
    spyOnToken();
    const app = express();

    app.get('/packages/featured', (_request, response) => {
      response.sendFile(path.join(__dirname, 'fixtures', 'packages.json'));
    });

    app.get('/themes/featured', (_request, response) => {
      response.sendFile(path.join(__dirname, 'fixtures', 'themes.json'));
    });

    server = http.createServer(app);

    await new Promise((resolve) => {
      server.listen(3000, '127.0.0.1', () => {
        process.env.ATOM_API_URL = 'http://localhost:3000';
        resolve();
      });
    });
  });

  afterEach(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it('lists the featured packages and themes', async () => {
    await apmRun(['featured']);
    expect(console.log).toHaveBeenCalled();
    expect(console.log.calls.argsFor(1)[0]).toContain('beverly-hills');
    expect(console.log.calls.argsFor(2)[0]).toContain('multi-version');
    expect(console.log.calls.argsFor(3)[0]).toContain('duckblur');
  });

  describe('when the theme flag is specified', () => {
    it('lists the featured themes', async () => {
      await apmRun(['featured', '--themes']);
      expect(console.log).toHaveBeenCalled();
      expect(console.log.calls.argsFor(1)[0]).toContain('duckblur');
      expect(console.log.calls.argsFor(2)[0]).toBeUndefined();
    });
  });
});
