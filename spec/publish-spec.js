const path = require('path');
const fs = require('fs-plus');
const temp = require('temp');
const express = require('express');
const http = require('http');
const childProcess = require('child_process');
const apm = require('../src/apm-cli');
const Publish = require('../src/publish');
const Command = require('../src/command');

describe('apm publish', () => {
  let server;

  let requests;
  beforeEach(() => {
    delete process.env.ATOM_PACKAGES_URL;
    spyOnToken();
    silenceOutput();

    spyOn(Command.prototype, 'spawn').andCallFake(
      (command, args, optionsOrCallback, callbackOrMissing) => {
        const [callback, options] = callbackOrMissing == null
          ? [optionsOrCallback]
          : [callbackOrMissing, optionsOrCallback];

        callback(0, '', '');
      }
    );

    spyOn(Publish.prototype, 'waitForTagToBeAvailable').andCallFake(
      () => {
        return Promise.resolve();
      }
    );

    spyOn(Publish.prototype, 'versionPackage').andCallFake(
      (version) => {
        return Promise.resolve('0.0.1');
      }
    );

    requests = [];
    const app = express();

    app.post('/api/packages', (req, res) => {
      requests.push(req);
      res.sendStatus(201);
    });

    app.post('/api/packages/:packageName/versions', (req, res) => {
      requests.push(req);
      res.sendStatus(201);
    });

    server = http.createServer(app);
    let live = false;
    server.listen(3000, '127.0.0.1', () => {
      process.env.ATOM_HOME = temp.mkdirSync('apm-home-dir-');
      process.env.ATOM_API_URL = 'http://localhost:3000/api';
      process.env.ATOM_RESOURCE_PATH = temp.mkdirSync('atom-resource-path-');
      setTimeout(() => {
        live = true;
      }, 3000);
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

  it("validates the package's package.json file", () => {
    const packageToPublish = temp.mkdirSync('apm-test-package-');
    fs.writeFileSync(path.join(packageToPublish, 'package.json'), '}{');
    process.chdir(packageToPublish);
    const callback = jasmine.createSpy('callback');
    apm.run(['publish'], callback);
    waitsFor('waiting for publish to complete', 600000, () => callback.callCount === 1);
    runs(() => {
      expect(callback.mostRecentCall.args[0].message).toBe('Error parsing package.json file: Unexpected token } in JSON at position 0');
    });
  });

  it('validates the package is in a Git repository', () => {
    const packageToPublish = temp.mkdirSync('apm-test-package-');
    const metadata = {
      name: 'test',
      version: '1.0.0'
    };
    fs.writeFileSync(path.join(packageToPublish, 'package.json'), JSON.stringify(metadata));
    process.chdir(packageToPublish);
    const callback = jasmine.createSpy('callback');
    apm.run(['publish'], callback);
    waitsFor('waiting for publish to complete', 600000, () => callback.callCount === 1);
    runs(() => {
      expect(callback.mostRecentCall.args[0].message).toBe('Package must be in a Git repository before publishing: https://help.github.com/articles/create-a-repo');
    });
  });

  it('validates the engines.atom range in the package.json file', () => {
    const packageToPublish = temp.mkdirSync('apm-test-package-');
    const metadata = {
      name: 'test',
      version: '1.0.0',
      engines: {
        atom: '><>'
      }
    };
    fs.writeFileSync(path.join(packageToPublish, 'package.json'), JSON.stringify(metadata));
    process.chdir(packageToPublish);
    const callback = jasmine.createSpy('callback');
    apm.run(['publish'], callback);
    waitsFor('waiting for publish to complete', 600000, () => callback.callCount === 1);
    runs(() => {
      expect(callback.mostRecentCall.args[0].message).toBe('The Pulsar or Atom engine range in the package.json file is invalid: ><>');
    });
  });

  it('validates the dependency semver ranges in the package.json file', () => {
    const packageToPublish = temp.mkdirSync('apm-test-package-');
    const metadata = {
      name: 'test',
      version: '1.0.0',
      engines: {
        atom: '1'
      },
      dependencies: {
        abc: 'git://github.com/user/project.git',
        abcd: 'latest',
        foo: '^^'
      }
    };
    fs.writeFileSync(path.join(packageToPublish, 'package.json'), JSON.stringify(metadata));
    process.chdir(packageToPublish);
    const callback = jasmine.createSpy('callback');
    apm.run(['publish'], callback);
    waitsFor('waiting for publish to complete', 600000, () => callback.callCount === 1);
    runs(() => {
      expect(callback.mostRecentCall.args[0].message).toBe('The foo dependency range in the package.json file is invalid: ^^');
    });
  });

  it('validates the dev dependency semver ranges in the package.json file', () => {
    const packageToPublish = temp.mkdirSync('apm-test-package-');
    const metadata = {
      name: 'test',
      version: '1.0.0',
      engines: {
        atom: '1'
      },
      dependencies: {
        foo: '^5'
      },
      devDependencies: {
        abc: 'git://github.com/user/project.git',
        abcd: 'latest',
        bar: '1,3'
      }
    };
    fs.writeFileSync(path.join(packageToPublish, 'package.json'), JSON.stringify(metadata));
    process.chdir(packageToPublish);
    const callback = jasmine.createSpy('callback');
    apm.run(['publish'], callback);
    waitsFor('waiting for publish to complete', 600000, () => callback.callCount === 1);
    runs(() => {
      expect(callback.mostRecentCall.args[0].message).toBe('The bar dev dependency range in the package.json file is invalid: 1,3');
    });
  });

  it('publishes successfully when new', () => {
    const packageToPublish = temp.mkdirSync('apm-test-package-');
    const metadata = {
      name: 'test',
      version: '1.0.0',
      "repository": {
        "type": "git",
        "url": "https://github.com/pulsar-edit/foo"
      },
      engines: {
        atom: '1'
      },
      dependencies: {
        foo: '^5'
      },
      devDependencies: {
        abc: 'git://github.com/user/project.git',
        abcd: 'latest',
      }
    };
    fs.writeFileSync(path.join(packageToPublish, 'package.json'), JSON.stringify(metadata));
    process.chdir(packageToPublish);

    childProcess.execSync('git init', { cwd: packageToPublish });
    childProcess.execSync('git remote add origin https://github.com/pulsar-edit/foo', { cwd: packageToPublish });

    const callback = jasmine.createSpy('callback');
    apm.run(['publish', 'patch'], callback);
    waitsFor('waiting for publish to complete', 600000, () => callback.callCount === 1);
    runs(() => {
      expect(requests.length).toBe(2);
      expect(callback.mostRecentCall.args[0]).toBeUndefined();
    });
  });

  it('publishes successfully when package exists', () => {
    spyOn(Publish.prototype, 'packageExists').andCallFake(() => {
      return Promise.resolve(true);
    });
    const packageToPublish = temp.mkdirSync('apm-test-package-');
    const metadata = {
      name: 'test',
      version: '1.0.0',
      "repository": {
        "type": "git",
        "url": "https://github.com/pulsar-edit/foo"
      },
      engines: {
        atom: '1'
      },
      dependencies: {
        foo: '^5'
      },
      devDependencies: {
        abc: 'git://github.com/user/project.git',
        abcd: 'latest',
      }
    };
    fs.writeFileSync(path.join(packageToPublish, 'package.json'), JSON.stringify(metadata));
    process.chdir(packageToPublish);

    childProcess.execSync('git init', { cwd: packageToPublish });
    childProcess.execSync('git remote add origin https://github.com/pulsar-edit/foo', { cwd: packageToPublish });

    const callback = jasmine.createSpy('callback');
    apm.run(['publish', 'patch'], callback);
    waitsFor('waiting for publish to complete', 600000, () => callback.callCount === 1);
    runs(() => {
      expect(requests.length).toBe(1);
      expect(callback.mostRecentCall.args[0]).toBeUndefined();
    });
  });
});
