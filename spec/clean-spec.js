/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const path = require('path');
const fs = require('fs-plus');
const temp = require('temp');
const express = require('express');
const http = require('http');
const wrench = require('wrench');
const apm = require('../lib/apm-cli');
const {
  nodeVersion
} = require('./config.json');

describe('apm clean', function() {
  let [moduleDirectory, server] = Array.from([]);

  beforeEach(function() {
    silenceOutput();
    spyOnToken();

    const app = express();

    app.get(`/node/${nodeVersion}/node-${nodeVersion}-headers.tar.gz`, (request, response) => response.sendFile(path.join(__dirname, 'fixtures', 'node-dist', `node-${nodeVersion}-headers.tar.gz`)));
    app.get(`/node/${nodeVersion}/win-x86/node.lib`, (request, response) => response.sendFile(path.join(__dirname, 'fixtures', 'node-dist', 'node.lib')));
    app.get(`/node/${nodeVersion}/win-x64/node.lib`, (request, response) => response.sendFile(path.join(__dirname, 'fixtures', 'node-dist', 'node_x64.lib')));
    app.get(`/node/${nodeVersion}/SHASUMS256.txt`, (request, response) => response.sendFile(path.join(__dirname, 'fixtures', 'node-dist', 'SHASUMS256.txt')));
    app.get('/test-module', (request, response) => response.sendFile(path.join(__dirname, 'fixtures', 'install-test-module.json')));
    app.get('/tarball/test-module-1.2.0.tgz', (request, response) => response.sendFile(path.join(__dirname, 'fixtures', 'test-module-1.2.0.tgz')));

    server = http.createServer(app);

    let live = false;
    server.listen(3000, '127.0.0.1', function() {
      console.log("Server started");
      const atomHome = temp.mkdirSync('apm-home-dir-');
      process.env.ATOM_HOME = atomHome;
      process.env.ATOM_ELECTRON_URL = "http://localhost:3000/node";
      process.env.ATOM_ELECTRON_VERSION = nodeVersion;
      process.env.npm_config_registry = 'http://localhost:3000/';

      moduleDirectory = path.join(temp.mkdirSync('apm-test-module-'), 'test-module-with-dependencies');
      wrench.copyDirSyncRecursive(path.join(__dirname, 'fixtures', 'test-module-with-dependencies'), moduleDirectory);
      process.chdir(moduleDirectory);
      return live = true;
    });
    return waitsFor(() => live);
  });

  afterEach(function() {
    let done = false;
    server.close(() => done = true);
    return waitsFor(() => done);
  });

  it('uninstalls any packages not referenced in the package.json', function() {
    const removedPath = path.join(moduleDirectory, 'node_modules', 'will-be-removed');
    fs.makeTreeSync(removedPath);
    fs.writeFileSync(
      path.join(removedPath, 'package.json'),
      '{"name": "will-be-removed", "version": "1.0.0", "dependencies": {}}',
      'utf8'
    );

    const callback = jasmine.createSpy('callback');
    apm.run(['clean'], callback);

    waitsFor('waiting for command to complete', () => callback.callCount > 0);

    return runs(function() {
      expect(callback.mostRecentCall.args[0]).toBeUndefined();
      return expect(fs.existsSync(removedPath)).toBeFalsy();
    });
  });

  return it('uninstalls a scoped package', function() {
    const removedPath = path.join(moduleDirectory, 'node_modules/@types/atom');
    fs.makeTreeSync(removedPath);
    fs.writeFileSync(
      path.join(removedPath, 'package.json'),
      '{"name": "@types/atom", "version": "1.0.0", "dependencies": {}}',
      'utf8'
    );

    const callback = jasmine.createSpy('callback');
    apm.run(['clean'], callback);

    waitsFor('waiting for command to complete', () => callback.callCount > 0);

    return runs(function() {
      expect(callback.mostRecentCall.args[0]).toBeUndefined();
      return expect(fs.existsSync(removedPath)).toBeFalsy();
    });
  });
});
