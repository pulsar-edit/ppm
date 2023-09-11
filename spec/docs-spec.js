const path = require('path');
const express = require('express');
const http = require('http');
const apm = require('../src/apm-cli');
let Docs = require('../src/docs');

describe('apm docs', () => {
  let server = null;

  beforeEach(() => {
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
    let live = false;

    server.listen(3000, '127.0.0.1', () => {
      process.env.ATOM_PACKAGES_URL = 'http://localhost:3000';
      live = true;
    });

    waitsFor(() => live);
  });

  afterEach(() => {
    let done = false;
    server.close(() => {
      done = true;
    });
    waitsFor(() => done);
  });

  it('logs an error if the package has no URL', async () => {
    const callback = jasmine.createSpy('callback');
    await apm.run(['docs', 'install']).then(callback, callback);
    waitsFor('waiting for command to complete', () => callback.callCount > 0);

    runs(() => {
      expect(console.error).toHaveBeenCalled();
      expect(console.error.argsForCall[0][0].length).toBeGreaterThan(0);
    });
  });

  it('logs an error if the package name is missing or empty', async () => {
    const callback = jasmine.createSpy('callback');
    await apm.run(['docs']).then(callback, callback);
    waitsFor('waiting for command to complete', () => callback.callCount > 0);

    runs(() => {
      expect(console.error).toHaveBeenCalled();
      expect(console.error.argsForCall[0][0].length).toBeGreaterThan(0);
    });
  });

  it('prints the package URL if called with the --print option (and does not open it)', async () => {
    spyOn(Docs.prototype, 'openRepositoryUrl');
    const callback = jasmine.createSpy('callback');
    await apm.run(['docs', '--print', 'wrap-guide']).then(callback, callback);
    waitsFor('waiting for command to complete', () => callback.callCount > 0);

    runs(() => {
      expect(Docs.prototype.openRepositoryUrl).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalled();
      expect(console.log.argsForCall[0][0]).toContain('https://github.com/atom/wrap-guide');
    });
  });

  it('prints the package URL if called with the -p short option (and does not open it)', async () => {
    Docs = require('../src/docs');
    spyOn(Docs.prototype, 'openRepositoryUrl');
    const callback = jasmine.createSpy('callback');
    await apm.run(['docs', '-p', 'wrap-guide']).then(callback, callback);
    waitsFor('waiting for command to complete', () => callback.callCount > 0);

    runs(() => {
      expect(Docs.prototype.openRepositoryUrl).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalled();
      expect(console.log.argsForCall[0][0]).toContain('https://github.com/atom/wrap-guide');
    });
  });

  it('opens the package URL', async () => {
    spyOn(Docs.prototype, 'openRepositoryUrl');
    const callback = jasmine.createSpy('callback');
    await apm.run(['docs', 'wrap-guide']).then(callback, callback);
    waitsFor('waiting for command to complete', () => callback.callCount > 0);

    runs(() => {
      expect(Docs.prototype.openRepositoryUrl).toHaveBeenCalled();
    });
  });
});
