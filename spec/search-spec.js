const path = require('path');
const express = require('express');
const http = require('http');

describe('apm search', () => {
  let server;

  beforeEach(async () => {
    silenceOutput();
    spyOnToken();

    const app = express();
    app.get('/search', (_request, response) => {
      response.sendFile(path.join(__dirname, 'fixtures', 'search.json'));
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
    await new Promise(resolve => server.close(resolve));
  });

  it('lists the matching packages and excludes deprecated packages', async () => {
    await apmRun(['search', 'duck']);

    expect(console.log).toHaveBeenCalled();
    expect(console.log.calls.argsFor(1)[0]).toContain('duckberg');
    expect(console.log.calls.argsFor(2)[0]).toContain('ducktales');
    expect(console.log.calls.argsFor(3)[0]).toContain('duckblur');
    expect(console.log.calls.argsFor(4)[0]).toBeUndefined();
  });

  it('logs an error if the query is missing or empty', async () => {
    await apmRun(['search']);

    expect(console.error).toHaveBeenCalled();
    expect(console.error.calls.argsFor(0)[0].length).toBeGreaterThan(0);
  });
});
