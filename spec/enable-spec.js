const path = require('path');
const temp = require('temp');
const CSON = require('season');

describe('apm enable', () => {
  beforeEach(() => {
    silenceOutput();
    spyOnToken();
  });

  it('enables a disabled package', async () => {
    const atomHome = temp.mkdirSync('apm-home-dir-');
    process.env.ATOM_HOME = atomHome;
    const configFilePath = path.join(atomHome, 'config.cson');

    CSON.writeFileSync(configFilePath, {
      '*': {
        core: {
          disabledPackages: ['metrics', 'vim-mode', 'exception-reporting', 'file-icons']
        }
      }
    });

    await apmRun(['enable', 'vim-mode', 'not-installed', 'file-icons']);

    expect(console.log).toHaveBeenCalled();
    expect(console.log.calls.argsFor(0)[0]).toMatch(/Not Disabled:\s*not-installed/);
    expect(console.log.calls.argsFor(1)[0]).toMatch(/Enabled:\s*vim-mode/);
    const config = CSON.readFileSync(configFilePath);

    expect(config).toEqual({
      '*': {
        core: {
          disabledPackages: ['metrics', 'exception-reporting']
        }
      }
    });
  });

  it('does nothing if a package is already enabled', async () => {
    const atomHome = temp.mkdirSync('apm-home-dir-');
    process.env.ATOM_HOME = atomHome;
    const configFilePath = path.join(atomHome, 'config.cson');

    CSON.writeFileSync(configFilePath, {
      '*': {
        core: {
          disabledPackages: ['metrics', 'exception-reporting']
        }
      }
    });

    await apmRun(['enable', 'vim-mode']);

    expect(console.log).toHaveBeenCalled();
    expect(console.log.calls.argsFor(0)[0]).toMatch(/Not Disabled:\s*vim-mode/);
    const config = CSON.readFileSync(configFilePath);

    expect(config).toEqual({
      '*': {
        core: {
          disabledPackages: ['metrics', 'exception-reporting']
        }
      }
    });
  });

  it('produces an error if config.cson doesn\'t exist', async () => {
    const atomHome = temp.mkdirSync('apm-home-dir-');
    process.env.ATOM_HOME = atomHome;

    await apmRun(['enable', 'vim-mode']);

    expect(console.error).toHaveBeenCalled();
    expect(console.error.calls.argsFor(0)[0].length).toBeGreaterThan(0);
  });

  it('complains if user supplies no packages', async () => {
    const atomHome = temp.mkdirSync('apm-home-dir-');
    process.env.ATOM_HOME = atomHome;

    await apmRun(['enable']);
    expect(console.error).toHaveBeenCalled();
    expect(console.error.calls.argsFor(0)[0].length).toBeGreaterThan(0);
  });
});
