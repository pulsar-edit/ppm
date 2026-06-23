const path = require('path');
const temp = require('temp');
const express = require('express');
const http = require('http');
const fs = require('fs-plus');
const { nodeVersion } = JSON.parse(fs.readFileSync(path.join(__dirname,'config.json')));

describe('apm rebuild', () => {
  let originalPathEnv, server;

  beforeEach(async () => {
    spyOnToken();
    silenceOutput();

    const app = express();
    app.get(
      `/node/${nodeVersion}/node-${nodeVersion}-headers.tar.gz`,
      (_request, response) => {
        response.sendFile(path.join(__dirname, 'fixtures', 'node-dist', `node-${nodeVersion}-headers.tar.gz`));
      }
    );
    app.get(
      `/node/${nodeVersion}/win-x86/node.lib`,
      (_request, response) => {
        response.sendFile(path.join(__dirname, 'fixtures', 'node-dist', 'node.lib'));
      }
    );
    app.get(
      `/node/${nodeVersion}/win-x64/node.lib`,
      (_request, response) => {
        response.sendFile(path.join(__dirname, 'fixtures', 'node-dist', 'node_x64.lib'));
      }
    );
    app.get(
      `/node/${nodeVersion}/SHASUMS256.txt`,
      (_request, response) => {
        response.sendFile(path.join(__dirname, 'fixtures', 'node-dist', 'SHASUMS256.txt'));
      }
    );

    server = http.createServer(app);

    await new Promise((resolve) => {
      server.listen(3000, '127.0.0.1', () => {
        process.env.ATOM_HOME = temp.mkdirSync('apm-home-dir-');
        process.env.ATOM_ELECTRON_URL = 'http://localhost:3000/node';
        process.env.ATOM_PACKAGES_URL = 'http://localhost:3000/packages';
        process.env.ATOM_ELECTRON_VERSION = nodeVersion;
        process.env.ATOM_RESOURCE_PATH = temp.mkdirSync('atom-resource-path-');

        originalPathEnv = process.env.PATH;
        process.env.PATH = '';
        resolve();
      });
    })
  });

  afterEach(async () => {
    process.env.PATH = originalPathEnv;
    await new Promise(resolve => server.close(resolve));
  });

  it('rebuilds all modules when no module names are specified', async () => {
    const packageToRebuild = path.join(__dirname, 'fixtures/package-with-native-deps');

    process.chdir(packageToRebuild);
    const callback = jasmine.createSpy('callback');
    await apmRun(['rebuild'], callback);
    expect(callback.calls.mostRecent().args[0]).toBeUndefined();
  });

  it('rebuilds the specified modules', async () => {
    const packageToRebuild = path.join(__dirname, 'fixtures/package-with-native-deps');

    process.chdir(packageToRebuild);
    const callback = jasmine.createSpy('callback');
    await apmRun(['rebuild', 'native-dep'], callback);
    expect(callback.calls.mostRecent().args[0]).toBeUndefined();
  });
});
