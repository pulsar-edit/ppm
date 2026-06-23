const path = require('path');
const express = require('express');
const http = require('http');
let Docs = require('../src/docs');

describe('apm docs', () => {
  let server = null;

  beforeEach(async () => {
    silenceOutput();
    spyOnToken();
    const app = express();

    app.get('/wrap-guide', (_request, response) => {
      response.sendFile(path.join(__dirname, 'fixtures', 'wrap-guide.json'));
    });

    app.get('/install', (_request, response) => {
      response.sendFile(path.join(__dirname, 'fixtures', 'install.json'));
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

  it('logs an error if the package has no URL', async () => {
    await apmRun(['docs', 'install']);

    expect(console.error).toHaveBeenCalled();
    expect(console.error.calls.argsFor(0)[0].length).toBeGreaterThan(0);
  });

  it('logs an error if the package name is missing or empty', async () => {
    await apmRun(['docs']);

    expect(console.error).toHaveBeenCalled();
    expect(console.error.calls.argsFor(0)[0].length).toBeGreaterThan(0);
  });

  it('prints the package URL if called with the --print option (and does not open it)', async () => {
    spyOn(Docs.prototype, 'openRepositoryUrl');
    await apmRun(['docs', '--print', 'wrap-guide']);

    expect(Docs.prototype.openRepositoryUrl).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalled();
    expect(console.log.calls.argsFor(0)[0]).toContain('https://github.com/atom/wrap-guide');
  });

  it('prints the package URL if called with the -p short option (and does not open it)', async () => {
    Docs = require('../src/docs');
    spyOn(Docs.prototype, 'openRepositoryUrl');
    await apmRun(['docs', '-p', 'wrap-guide']);

    expect(Docs.prototype.openRepositoryUrl).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalled();
    expect(console.log.calls.argsFor(0)[0]).toContain('https://github.com/atom/wrap-guide');
  });

  it('opens the package URL', async () => {
    spyOn(Docs.prototype, 'openRepositoryUrl');
    await apmRun(['docs', 'wrap-guide']);

    expect(Docs.prototype.openRepositoryUrl).toHaveBeenCalled();
  });
});
