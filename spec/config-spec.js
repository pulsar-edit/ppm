const path = require('path');
const fs = require('fs-plus');
const temp = require('temp');

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
      await apmRun(['config', 'get', 'cache']);
      expect(
        process.stdout.write.calls.argsFor(0)[0].trim()
      ).toBe(path.join(process.env.ATOM_HOME, '.apm'));
    });
  });

  describe('apm config set', () => {
    it('sets the value in the user config', async () => {
      expect(fs.isFileSync(userConfigPath)).toBe(false);
      await apmRun(['config', 'set', 'foo', 'bar']);
      expect(fs.isFileSync(userConfigPath)).toBe(true);
      await apmRun(['config', 'get', 'foo']);
      expect(
        process.stdout.write.calls.argsFor(0)[0].trim()
      ).toBe('bar');
    });
  });
});
