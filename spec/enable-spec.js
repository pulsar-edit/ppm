const fs = require('fs');
const path = require('path');
const temp = require('temp');
const CSON = require('season');
const apm = require('../src/apm-cli');

describe('apm enable', () => {
  beforeEach(() => {
    silenceOutput();
    spyOnToken();
  });

  it('enables a disabled package', () => {
    const atomHome = temp.mkdirSync('apm-home-dir-');
    process.env.ATOM_HOME = atomHome;
    const callback = jasmine.createSpy('callback');
    const configFilePath = path.join(atomHome, 'config.cson');

    CSON.writeFileSync(configFilePath, {
      '*': {
        core: {
          disabledPackages: ['metrics', 'vim-mode', 'exception-reporting', 'file-icons']
        }
      }
    });

    runs(async () => {
      await apm.run(['enable', 'vim-mode', 'not-installed', 'file-icons'], callback);
    });

    waitsFor('waiting for enable to complete', () => callback.callCount > 0);

    runs(() => {
      expect(console.log).toHaveBeenCalled();
      expect(console.log.argsForCall[0][0]).toMatch(/Not Disabled:\s*not-installed/);
      expect(console.log.argsForCall[1][0]).toMatch(/Enabled:\s*vim-mode/);
      const config = CSON.readFileSync(configFilePath);

      expect(config).toEqual({
        '*': {
          core: {
            disabledPackages: ['metrics', 'exception-reporting']
          }
        }
      });
    });
  });

  it('does nothing if a package is already enabled', () => {
    const atomHome = temp.mkdirSync('apm-home-dir-');
    process.env.ATOM_HOME = atomHome;
    const callback = jasmine.createSpy('callback');
    const configFilePath = path.join(atomHome, 'config.cson');

    CSON.writeFileSync(configFilePath, {
      '*': {
        core: {
          disabledPackages: ['metrics', 'exception-reporting']
        }
      }
    });

    runs(async () => {
      await apm.run(['enable', 'vim-mode'], callback);
    });

    waitsFor('waiting for enable to complete', () => callback.callCount > 0);

    runs(() => {
      expect(console.log).toHaveBeenCalled();
      expect(console.log.argsForCall[0][0]).toMatch(/Not Disabled:\s*vim-mode/);
      const config = CSON.readFileSync(configFilePath);

      expect(config).toEqual({
        '*': {
          core: {
            disabledPackages: ['metrics', 'exception-reporting']
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
      await apm.run(['enable', 'vim-mode'], callback);
    });

    waitsFor('waiting for enable to complete', () => callback.callCount > 0);

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
      await apm.run(['enable'], callback);
    });
    waitsFor('waiting for enable to complete', () => callback.callCount > 0);
    runs(() => {
      expect(console.error).toHaveBeenCalled();
      expect(console.error.argsForCall[0][0].length).toBeGreaterThan(0);
    });
  });
});
