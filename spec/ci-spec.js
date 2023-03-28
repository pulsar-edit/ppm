const path = require('path');
const fs = require('fs');
const http = require('http');
const temp = require('temp');
const express = require('express');
const wrench = require('wrench');
const CSON = require('season');
const apm = require('../lib/apm-cli');

describe('apm ci', () => {
  let [atomHome, resourcePath, server] = Array.from([]);

  beforeEach(() => {
    spyOnToken();
    silenceOutput();
    atomHome = temp.mkdirSync('apm-home-dir-');
    process.env.ATOM_HOME = atomHome;

    resourcePath = temp.mkdirSync('atom-resource-path-');
    process.env.ATOM_RESOURCE_PATH = resourcePath;
    delete process.env.npm_config_cache;
    const app = express();
    app.get(`/node/${nodeVersion}/node-${nodeVersion}-headers.tar.gz`, (_request, response) => response.sendFile(path.join(__dirname, 'fixtures', 'node-dist', `node-${nodeVersion}-headers.tar.gz`)));
    app.get(`/node/${nodeVersion}/win-x86/node.lib`, (_request, response) => response.sendFile(path.join(__dirname, 'fixtures', 'node-dist', 'node.lib')));
    app.get(`/node/${nodeVersion}/win-x64/node.lib`, (_request, response) => response.sendFile(path.join(__dirname, 'fixtures', 'node-dist', 'node_x64.lib')));
    app.get(`/node/${nodeVersion}/SHASUMS256.txt`, (_request, response) => response.sendFile(path.join(__dirname, 'fixtures', 'node-dist', 'SHASUMS256.txt')));
    app.get('/test-module-with-dependencies', (_request, response) => response.sendFile(path.join(__dirname, 'fixtures', 'install-locked-version.json')));
    app.get('/test-module', (_request, response) => response.sendFile(path.join(__dirname, 'fixtures', 'install-test-module.json')));
    app.get('/native-module', (_request, response) => response.sendFile(path.join(__dirname, 'fixtures', 'native-module.json')));
    app.get('/tarball/test-module-with-dependencies-1.1.0.tgz', (_request, response) => response.sendFile(path.join(__dirname, 'fixtures', 'test-module-with-dependencies-1.1.0.tgz')));
    app.get('/tarball/test-module-1.1.0.tgz', (_request, response) => response.sendFile(path.join(__dirname, 'fixtures', 'test-module-1.1.0.tgz')));
    app.get('/tarball/native-module-1.0.0.tgz', (_request, response) => response.sendFile(path.join(__dirname, 'fixtures', 'native-module-1.0.0.tgz')));
    server = http.createServer(app);
    let live = false;
    server.listen(3000, '127.0.0.1', () => {
      process.env.ATOM_ELECTRON_URL = 'http://localhost:3000/node';
      process.env.ATOM_PACKAGES_URL = 'http://localhost:3000/packages';
      process.env.ATOM_ELECTRON_VERSION = nodeVersion;
      process.env.npm_config_registry = 'http://localhost:3000/';
      live = true;
    });
    waitsFor(() => live);
  })

  afterEach(() => {
    let done = false;
    server.close(() => {
      done = true;
    });
    waitsFor(() => done);
  });

  it('installs dependency versions as specified by the lockfile', () => {
    const moduleDirectory = path.join(temp.mkdirSync('apm-test-'), 'test-module-with-lockfile');
    wrench.copyDirSyncRecursive(path.join(__dirname, 'fixtures', 'test-module-with-lockfile'), moduleDirectory);
    process.chdir(moduleDirectory);
    const callback = jasmine.createSpy('callback');
    apm.run(['ci'], callback);
    waitsFor('waiting for install to complete', 600000, () => callback.callCount > 0);
    runs(() => {
      expect(callback.mostRecentCall.args[0]).toBeNull();
      const pjson0 = CSON.readFileSync(path.join('node_modules', 'test-module-with-dependencies', 'package.json'));
      expect(pjson0.version).toBe('1.1.0');
      const pjson1 = CSON.readFileSync(path.join('node_modules', 'test-module', 'package.json'));
      expect(pjson1.version).toBe('1.1.0');
    });
  });

  it('builds a native dependency correctly', () => {
    const moduleDirectory = path.join(temp.mkdirSync('apm-test-'), 'test-module-with-native');
    wrench.copyDirSyncRecursive(path.join(__dirname, 'fixtures', 'test-module-with-lockfile'), moduleDirectory);
    process.chdir(moduleDirectory);
    const pjsonPath = path.join(moduleDirectory, 'package.json');
    const pjson = CSON.readFileSync(pjsonPath);
    pjson.dependencies['native-module'] = '^1.0.0';
    CSON.writeFileSync(pjsonPath, pjson);
    const callback0 = jasmine.createSpy('callback');
    const callback1 = jasmine.createSpy('callback');
    apm.run(['install'], callback0);
    waitsFor('waiting for install to complete', 600000, () => callback0.callCount > 0);
    runs(() => {
      expect(callback0.mostRecentCall.args[0]).toBeNull();
      apm.run(['ci'], callback1);
    });
    waitsFor('waiting for ci to complete', 600000, () => callback1.callCount > 0);
    runs(() => {
      expect(callback1.mostRecentCall.args[0]).toBeNull();
      expect(fs.existsSync(path.join(moduleDirectory, 'node_modules', 'native-module', 'build', 'Release', 'native.node'))).toBeTruthy();
    });
  });

  it('fails if the lockfile is not present', () => {
    const moduleDirectory = path.join(temp.mkdirSync('apm-test-'), 'test-module');
    wrench.copyDirSyncRecursive(path.join(__dirname, 'fixtures', 'test-module'), moduleDirectory);
    process.chdir(moduleDirectory);
    const callback = jasmine.createSpy('callback');
    apm.run(['ci'], callback);
    waitsFor('waiting for install to complete', 600000, () => callback.callCount > 0);
    runs(() => {
      expect(callback.mostRecentCall.args[0]).not.toBeNull();
    });
  });

  it('fails if the lockfile is out of date', () => {
    const moduleDirectory = path.join(temp.mkdirSync('apm-test-'), 'test-module-with-lockfile');
    wrench.copyDirSyncRecursive(path.join(__dirname, 'fixtures', 'test-module-with-lockfile'), moduleDirectory);
    process.chdir(moduleDirectory);
    const pjsonPath = path.join(moduleDirectory, 'package.json');
    const pjson = CSON.readFileSync(pjsonPath);
    pjson.dependencies['test-module'] = '^1.2.0';
    CSON.writeFileSync(pjsonPath, pjson);
    const callback = jasmine.createSpy('callback');
    apm.run(['ci'], callback);
    waitsFor('waiting for install to complete', 600000, () => callback.callCount > 0);
    runs(() => {
      expect(callback.mostRecentCall.args[0]).not.toBeNull();
    });
  });
});
