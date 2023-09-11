const fs = require('fs-plus');
const wrench = require('wrench');
const path = require('path');
const temp = require('temp');
const CSON = require('season');
const apm = require('../src/apm-cli');

describe('apm disable', () => {
  beforeEach(() => {
    silenceOutput();
    spyOnToken();
  });

  it('disables an enabled package', () => {
    const atomHome = temp.mkdirSync('apm-home-dir-');
    process.env.ATOM_HOME = atomHome;
    const callback = jasmine.createSpy('callback');
    const configFilePath = path.join(atomHome, 'config.cson');

    CSON.writeFileSync(configFilePath, {
      '*': {
        core: {
          disabledPackages: ['test-module']
        }
      }
    });

    const packagesPath = path.join(atomHome, 'packages');
    const packageSrcPath = path.join(__dirname, 'fixtures');
    fs.makeTreeSync(packagesPath);
    wrench.copyDirSyncRecursive(path.join(packageSrcPath, 'test-module'), path.join(packagesPath, 'test-module'));
    wrench.copyDirSyncRecursive(path.join(packageSrcPath, 'test-module-two'), path.join(packagesPath, 'test-module-two'));
    wrench.copyDirSyncRecursive(path.join(packageSrcPath, 'test-module-three'), path.join(packagesPath, 'test-module-three'));

    runs(async () => {
      await apm.run(['disable', 'test-module-two', 'not-installed', 'test-module-three']).then(callback, callback);
    });
    waitsFor('waiting for disable to complete', () => callback.callCount > 0);
    runs(() => {
      expect(console.log).toHaveBeenCalled();
      expect(console.log.argsForCall[0][0]).toMatch(/Not Installed:\s*not-installed/);
      expect(console.log.argsForCall[1][0]).toMatch(/Disabled:\s*test-module-two/);
      const config = CSON.readFileSync(configFilePath);
      expect(config).toEqual({
        '*': {
          core: {
            disabledPackages: ['test-module', 'test-module-two', 'test-module-three']
          }
        }
      });
    });
  });

  it('does nothing if a package is already disabled', () => {
    const atomHome = temp.mkdirSync('apm-home-dir-');
    process.env.ATOM_HOME = atomHome;
    const callback = jasmine.createSpy('callback');
    const configFilePath = path.join(atomHome, 'config.cson');

    CSON.writeFileSync(configFilePath, {
      '*': {
        core: {
          disabledPackages: ['vim-mode', 'file-icons', 'metrics', 'exception-reporting']
        }
      }
    });

    runs(async () => {
      await apm.run(['disable', 'vim-mode', 'metrics']).then(callback, callback);
    });
    waitsFor('waiting for disable to complete', () => callback.callCount > 0);
    runs(() => {
      const config = CSON.readFileSync(configFilePath);
      expect(config).toEqual({
        '*': {
          core: {
            disabledPackages: ['vim-mode', 'file-icons', 'metrics', 'exception-reporting']
          }
        }
      });
    });
  });

  it('produces an error if config.cson doesn\'t exist', () => {
    const atomHome = temp.mkdirSync('apm-home-dir-');
    process.env.ATOM_HOME = atomHome;
    const callback = jasmine.createSpy('callback');

    runs(async () => {
      await apm.run(['disable', 'vim-mode']).then(callback, callback);
    });
    waitsFor('waiting for disable to complete', () => callback.callCount > 0);
    runs(() => {
      expect(console.error).toHaveBeenCalled();
      expect(console.error.argsForCall[0][0].length).toBeGreaterThan(0);
    });
  });

  it('complains if user supplies no packages', () => {
    const atomHome = temp.mkdirSync('apm-home-dir-');
    process.env.ATOM_HOME = atomHome;
    const callback = jasmine.createSpy('callback');

    runs(async () => {
      await apm.run(['disable']).then(callback, callback);
    });
    waitsFor('waiting for disable to complete', () => callback.callCount > 0);
    runs(() => {
      expect(console.error).toHaveBeenCalled();
      expect(console.error.argsForCall[0][0].length).toBeGreaterThan(0);
    });
  });
});
