const path = require('path');
const express = require('express');
const fs = require('fs-plus');
const http = require('http');
const temp = require('temp');
const apm = require('../src/apm-cli');
const { nodeVersion } = JSON.parse(fs.readFileSync(path.join(__dirname,'config.json')));

describe('apm stars', () => {
  let atomHome, server;

  beforeEach(() => {
    silenceOutput();
    spyOnToken();

    const app = express();
    app.get('/stars', (_request, response) => response.sendFile(path.join(__dirname, 'fixtures', 'available.json')));
    app.get('/users/hubot/stars', (_request, response) => response.sendFile(path.join(__dirname, 'fixtures', 'stars.json')));
    app.get(`/node/${nodeVersion}/node-${nodeVersion}-headers.tar.gz`, (_request, response) => response.sendFile(path.join(__dirname, 'fixtures', 'node-dist', `node-${nodeVersion}-headers.tar.gz`)));
    app.get(`/node/${nodeVersion}/win-x86/node.lib`, (_request, response) => response.sendFile(path.join(__dirname, 'fixtures', 'node-dist', 'node.lib')));
    app.get(`/node/${nodeVersion}/win-x64/node.lib`, (_request, response) => response.sendFile(path.join(__dirname, 'fixtures', 'node-dist', 'node_x64.lib')));
    app.get(`/node/${nodeVersion}/SHASUMS256.txt`, (_request, response) => response.sendFile(path.join(__dirname, 'fixtures', 'node-dist', 'SHASUMS256.txt')));
    app.get('/tarball/test-module-1.2.0.tgz', (_request, response) => response.sendFile(path.join(__dirname, 'fixtures', 'test-module-1.2.0.tgz')));
    app.get('/tarball/test-module2-2.0.0.tgz', (_request, response) => response.sendFile(path.join(__dirname, 'fixtures', 'test-module2-2.0.0.tgz')));
    app.get('/packages/test-module', (_request, response) => response.sendFile(path.join(__dirname, 'fixtures', 'install-test-module.json')));

    server = http.createServer(app);

    let live = false;
    server.listen(3000, '127.0.0.1', () => {
      atomHome = temp.mkdirSync('apm-home-dir-');
      process.env.ATOM_HOME = atomHome;
      process.env.ATOM_API_URL = 'http://localhost:3000';
      process.env.ATOM_ELECTRON_URL = 'http://localhost:3000/node';
      process.env.ATOM_PACKAGES_URL = 'http://localhost:3000/packages';
      process.env.ATOM_ELECTRON_VERSION = nodeVersion;
      process.env.npm_config_registry = 'http://localhost:3000/';
      live = true;
    });
    waitsFor(() => live);
  });

  afterEach(() => {
    let closed = false;
    server.close(() => {
      closed = true;
    });
    waitsFor(() => closed);
  });

  describe('when no user flag is specified', () => {
    it('lists your starred packages', async () => {
      const callback = jasmine.createSpy('callback');
      await apm.run(['stars']).then(callback, callback);

      waitsFor('waiting for command to complete', () => callback.callCount > 0);
      runs(() => {
        expect(console.log).toHaveBeenCalled();
        expect(console.log.argsForCall[1][0]).toContain('beverly-hills');
      });
    });
  });

  describe('when a user flag is specified', () => {
    it('lists their starred packages', async () => {
      const callback = jasmine.createSpy('callback');
      await apm.run(['stars', '--user', 'hubot']).then(callback, callback);

      waitsFor('waiting for command to complete', () => callback.callCount > 0);
      runs(() => {
        expect(console.log).toHaveBeenCalled();
        expect(console.log.argsForCall[1][0]).toContain('test-module');
      });
    });
  });

  describe('when the install flag is specified', () => {
    it('installs all of the stars', async () => {
      const testModuleDirectory = path.join(atomHome, 'packages', 'test-module');
      expect(fs.existsSync(testModuleDirectory)).toBeFalsy();
      const callback = jasmine.createSpy('callback');
      await apm.run(['stars', '--user', 'hubot', '--install']).then(callback, callback);

      waitsFor('waiting for command to complete', () => callback.callCount > 0);
      runs(() => {
        expect(callback.mostRecentCall.args[0]).toBeNull();
        expect(fs.existsSync(path.join(testModuleDirectory, 'index.js'))).toBeTruthy();
        expect(fs.existsSync(path.join(testModuleDirectory, 'package.json'))).toBeTruthy();
      });
    });
  });

  describe('when the theme flag is specified', () => {
    it('only lists themes', async () => {
      const callback = jasmine.createSpy('callback');
      await apm.run(['stars', '--themes']).then(callback, callback);

      waitsFor('waiting for command to complete', () => callback.callCount > 0);
      runs(() => {
        expect(console.log).toHaveBeenCalled();
        expect(console.log.argsForCall[1][0]).toContain('duckblur');
        expect(console.log.argsForCall[1][0]).not.toContain('beverly-hills');
      });
    });
  });
});
