const path = require('path');
const fs = require('fs-plus');
const temp = require('temp');
const express = require('express');
const http = require('http');
const childProcess = require('child_process');
const Publish = require('../src/publish');
const Command = require('../src/command');

describe('apm publish', () => {
  let server;

  let requests;
  let originalInterval = jasmine.DEFAULT_TIMEOUT_INTERVAL;

  afterAll(() => {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = originalInterval;
  });
  beforeEach(async () => {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 5000;
    delete process.env.ATOM_PACKAGES_URL;
    spyOnToken();
    silenceOutput();

    spyOn(Command.prototype, 'spawn').and.callFake(
      (_command, _args, optionsOrCallback, callbackOrMissing) => {
        const [callback, _options] = callbackOrMissing == null
          ? [optionsOrCallback]
          : [callbackOrMissing, optionsOrCallback];

        callback(0, '', '');
      }
    );

    spyOn(Publish.prototype, 'waitForTagToBeAvailable').and.callFake(
      () => {
        return Promise.resolve();
      }
    );

    spyOn(Publish.prototype, 'versionPackage').and.callFake(
      (_version) => {
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
    await new Promise((resolve) => {
      server.listen(3000, '127.0.0.1', async () => {
        process.env.ATOM_HOME = temp.mkdirSync('apm-home-dir-');
        process.env.ATOM_API_URL = 'http://localhost:3000/api';
        process.env.ATOM_RESOURCE_PATH = temp.mkdirSync('atom-resource-path-');
        resolve();
      });
    });
  });

  afterEach(async () => {
    await new Promise(resolve => server.close(resolve));
  });

  it("validates the package's package.json file", async () => {
    const packageToPublish = temp.mkdirSync('apm-test-package-');
    fs.writeFileSync(path.join(packageToPublish, 'package.json'), '}{');
    process.chdir(packageToPublish);
    const callback = jasmine.createSpy('callback');
    await apmRun(['publish'], callback);
    expect(callback.calls.mostRecent().args[0].message).toBe(
      `Error parsing package.json file: Unexpected token '}', "}{" is not valid JSON`
    );
  });

  it('validates the package is in a Git repository', async () => {
    const packageToPublish = temp.mkdirSync('apm-test-package-');
    const metadata = {
      name: 'test',
      version: '1.0.0'
    };
    fs.writeFileSync(
      path.join(packageToPublish, 'package.json'),
      JSON.stringify(metadata)
    );
    process.chdir(packageToPublish);
    const callback = jasmine.createSpy('callback');
    await apmRun(['publish'], callback);
    expect(callback.calls.mostRecent().args[0].message).toBe(
      'Package must be in a Git repository before publishing: https://help.github.com/articles/create-a-repo'
    );
  });

  it('validates the engines.atom range in the package.json file', async () => {
    const packageToPublish = temp.mkdirSync('apm-test-package-');
    const metadata = {
      name: 'test',
      version: '1.0.0',
      engines: {
        atom: '><>'
      }
    };
    fs.writeFileSync(
      path.join(packageToPublish, 'package.json'),
      JSON.stringify(metadata)
    );
    process.chdir(packageToPublish);
    const callback = jasmine.createSpy('callback');
    await apmRun(['publish'], callback);
    expect(callback.calls.mostRecent().args[0].message).toBe(
      'The Pulsar or Atom engine range in the package.json file is invalid: ><>'
    );
  });

  it('validates the dependency semver ranges in the package.json file', async () => {
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
    await apmRun(['publish'], callback);
    expect(callback.calls.mostRecent().args[0].message).toBe(
      'The foo dependency range in the package.json file is invalid: ^^'
    );
  });

  it('validates the dev dependency semver ranges in the package.json file', async () => {
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
    fs.writeFileSync(
      path.join(packageToPublish, 'package.json'),
      JSON.stringify(metadata)
    );
    process.chdir(packageToPublish);
    const callback = jasmine.createSpy('callback');
    await apmRun(['publish'], callback);
    expect(callback.calls.mostRecent().args[0].message).toBe(
      'The bar dev dependency range in the package.json file is invalid: 1,3'
    );
  });

  it('publishes successfully when new', async () => {
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
    fs.writeFileSync(
      path.join(packageToPublish, 'package.json'),
      JSON.stringify(metadata)
    );
    process.chdir(packageToPublish);

    childProcess.execSync('git init', { cwd: packageToPublish });
    childProcess.execSync('git remote add origin https://github.com/pulsar-edit/foo', { cwd: packageToPublish });

    const callback = jasmine.createSpy('callback');
    await apmRun(['publish', 'patch'], callback);
    expect(requests.length).toBe(1);
    expect(callback.calls.mostRecent().args[0]).toBeUndefined();
  });

  it('publishes successfully when package exists', async () => {
    spyOn(Publish.prototype, 'packageExists').and.callFake(() => {
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
    fs.writeFileSync(
      path.join(packageToPublish, 'package.json'),
      JSON.stringify(metadata)
    );
    process.chdir(packageToPublish);

    childProcess.execSync('git init', { cwd: packageToPublish });
    childProcess.execSync('git remote add origin https://github.com/pulsar-edit/foo', { cwd: packageToPublish });

    const callback = jasmine.createSpy('callback');
    await apmRun(['publish', 'patch'], callback);
    expect(requests.length).toBe(1);
    expect(callback.calls.mostRecent().args[0]).toBeUndefined();
  });

  it('publishes successfully when the package exists and is being renamed', async () => {
    spyOn(Publish.prototype, 'packageExists').and.callFake((name) => {
      // If we're renaming the package, we need to ask the API if the package's
      // _old_ name exists. This mock will simulate what the API would say if
      // we mistakenly ask it if the _new_ name exists.
      return name === 'test';
    });
    let publishPackageSpy = spyOn(Publish.prototype, 'publishPackage').and.callThrough();
    let registerPackageSpy = spyOn(Publish.prototype, 'registerPackage').and.callThrough();

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
    await apmRun(['publish', 'patch', '--rename', 'test-renamed'], callback);
    expect(registerPackageSpy.calls.count()).toBe(0);
    expect(publishPackageSpy.calls.count()).toBe(1);
    expect(
      publishPackageSpy.calls.mostRecent()?.args?.[2]?.rename
    ).toBe('test-renamed');
    expect(requests.length).toBe(1);
    expect(callback.calls.mostRecent().args[0]).toBeUndefined();
  });
});
