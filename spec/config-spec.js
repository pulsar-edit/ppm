const path = require('path');
const fs = require('fs-plus');
const temp = require('temp');
const apm = require('../lib/apm-cli');

describe('apm config', () => {
  let userConfigPath;

  beforeEach(() => {
    spyOnToken();
    silenceOutput();
    const atomHome = temp.mkdirSync('apm-home-dir-');
    process.env.ATOM_HOME = atomHome;
    userConfigPath = path.join(atomHome, '.apmrc');
    delete process.env.npm_config_cache;
  });

  describe('apm config get', () => {
    it('reads the value from the global config when there is no user config', () => {
      const callback = jasmine.createSpy('callback');
      apm.run(['config', 'get', 'cache'], callback);
      waitsFor('waiting for config get to complete', 600000, () => callback.callCount === 1);
      runs(() => {
        expect(process.stdout.write.argsForCall[0][0].trim()).toBe(path.join(process.env.ATOM_HOME, '.apm'));
      });
    });
  });

  describe('apm config set', () => {
    it('sets the value in the user config', () => {
      expect(fs.isFileSync(userConfigPath)).toBe(false);
      const callback = jasmine.createSpy('callback');
      apm.run(['config', 'set', 'foo', 'bar'], callback);
      waitsFor('waiting for config set to complete', 600000, () => callback.callCount === 1);
      runs(() => {
        expect(fs.isFileSync(userConfigPath)).toBe(true);
        callback.reset();
        apm.run(['config', 'get', 'foo'], callback);
      });
      waitsFor('waiting for config get to complete', 600000, () => callback.callCount === 1);
      runs(() => {
        expect(process.stdout.write.argsForCall[0][0].trim()).toBe('bar');
      });
    });
  });
});
