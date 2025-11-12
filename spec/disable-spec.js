const fs = require('fs-plus');
const wrench = require('wrench');
const path = require('path');
const temp = require('temp');
const CSON = require('season');

describe('apm disable', () => {
  beforeEach(() => {
    silenceOutput();
    spyOnToken();
  });

  it('disables an enabled package', async () => {
    const atomHome = temp.mkdirSync('apm-home-dir-');
    process.env.ATOM_HOME = atomHome;
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
    wrench.copyDirSyncRecursive(
      path.join(packageSrcPath, 'test-module'),
      path.join(packagesPath, 'test-module')
    );
    wrench.copyDirSyncRecursive(
      path.join(packageSrcPath, 'test-module-two'),
      path.join(packagesPath, 'test-module-two')
    );
    wrench.copyDirSyncRecursive(
      path.join(packageSrcPath, 'test-module-three'),
      path.join(packagesPath, 'test-module-three')
    );

    await apmRun(['disable', 'test-module-two', 'not-installed', 'test-module-three']);

    expect(console.log).toHaveBeenCalled();
    expect(console.log.calls.argsFor(0)[0]).toMatch(/Not Installed:\s*not-installed/);
    expect(console.log.calls.argsFor(1)[0]).toMatch(/Disabled:\s*test-module-two/);
    const config = CSON.readFileSync(configFilePath);
    expect(config).toEqual({
      '*': {
        core: {
          disabledPackages: ['test-module', 'test-module-two', 'test-module-three']
        }
      }
    });
  });

  it('does nothing if a package is already disabled', async () => {
    const atomHome = temp.mkdirSync('apm-home-dir-');
    process.env.ATOM_HOME = atomHome;
    const configFilePath = path.join(atomHome, 'config.cson');

    CSON.writeFileSync(configFilePath, {
      '*': {
        core: {
          disabledPackages: ['vim-mode', 'file-icons', 'metrics', 'exception-reporting']
        }
      }
    });

    await apmRun(['disable', 'vim-mode', 'metrics']);
    const config = CSON.readFileSync(configFilePath);
    expect(config).toEqual({
      '*': {
        core: {
          disabledPackages: ['vim-mode', 'file-icons', 'metrics', 'exception-reporting']
        }
      }
    });
  });

  it('produces an error if config.cson doesn\'t exist', async () => {
    const atomHome = temp.mkdirSync('apm-home-dir-');
    process.env.ATOM_HOME = atomHome;
    await apmRun(['disable', 'vim-mode']);
    expect(console.error).toHaveBeenCalled();
    expect(console.error.calls.argsFor(0)[0].length).toBeGreaterThan(0);
  });

  it('complains if user supplies no packages', async () => {
    const atomHome = temp.mkdirSync('apm-home-dir-');
    process.env.ATOM_HOME = atomHome;

    await apmRun(['disable']);
    expect(console.error).toHaveBeenCalled();
    expect(console.error.calls.argsFor(0)[0].length).toBeGreaterThan(0);
  });
});
