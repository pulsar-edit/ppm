const path = require('path');
const fs = require('fs-plus');
const temp = require('temp');
const apm = require('../src/apm-cli');

describe('apm config', () => {
  let userConfigPath;

  beforeEach(() => {
    spyOnToken();
    silenceOutput();
    const atomHome = temp.mkdirSync('apm-home-dir-');
    process.env.ATOM_HOME = atomHome;
    userConfigPath = path.join(atomHome, '.apmrc');
    // Make sure the cache used is the one for the test env
    delete process.env.npm_config_cache;
  });

  describe('apm config get', () => {
    it('reads the value from the global config when there is no user config', async () => {
      const callback = jasmine.createSpy('callback');
      await apm.run(['config', 'get', 'cache']).then(callback, callback);
      waitsFor('waiting for config get to complete', 600000, () => callback.callCount === 1);
      runs(() => {
        expect(process.stdout.write.argsForCall[0][0].trim()).toBe(path.join(process.env.ATOM_HOME, '.apm'));
      });
    });
  });

  describe('apm config set', () => {
    it('sets the value in the user config', async () => {
      expect(fs.isFileSync(userConfigPath)).toBe(false);
      const callback = jasmine.createSpy('callback');
      await apm.run(['config', 'set', 'foo', 'bar']).then(callback, callback);
      waitsFor('waiting for config set to complete', 600000, () => callback.callCount === 1);
      runs(async () => {
        expect(fs.isFileSync(userConfigPath)).toBe(true);
        callback.reset();
        await apm.run(['config', 'get', 'foo']).then(callback, callback);
      });
      waitsFor('waiting for config get to complete', 600000, () => callback.callCount === 1);
      runs(() => {
        expect(process.stdout.write.argsForCall[0][0].trim()).toBe('bar');
      });
    });
  });
});
