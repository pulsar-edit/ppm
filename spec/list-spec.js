const path = require('path');
const fs = require('fs-plus');
const fsPromises = require('fs/promises');
const temp = require('temp');
const CSON = require('season');

async function listPackages (...args) {
  await apmRun(['list', ...args]);
}

function createFakePackage (type, metadata) {
  const packagesFolder = (() => {
    switch (type) {
      case 'user':
      case 'git':
        return 'packages';
      case 'dev':
        return path.join('dev', 'packages');
    }
  })();
  const targetFolder = path.join(process.env.ATOM_HOME, packagesFolder, metadata.name);
  fs.makeTreeSync(targetFolder);
  fs.writeFileSync(path.join(targetFolder, 'package.json'), JSON.stringify(metadata));
}

function removeFakePackage (type, name) {
  const packagesFolder = (() => {
    switch (type) {
      case 'user':
      case 'git':
        return 'packages';
      case 'dev':
        return path.join('dev', 'packages');
    }
  })();
  const targetFolder = path.join(process.env.ATOM_HOME, packagesFolder, name);
  fs.removeSync(targetFolder);
}

describe('apm list', () => {
  let atomHome, resourcePath;

  beforeEach(() => {
    silenceOutput();
    spyOnToken();
    resourcePath = temp.mkdirSync('apm-resource-path-');
    const atomPackages = {
      'test-module': {
        metadata: {
          name: 'test-module',
          version: '1.0.0'
        }
      }
    };
    fs.writeFileSync(
      path.join(resourcePath, 'package.json'),
      JSON.stringify({_atomPackages: atomPackages})
    );
    process.env.ATOM_RESOURCE_PATH = resourcePath;
    atomHome = temp.mkdirSync('apm-home-dir-');
    process.env.ATOM_HOME = atomHome;

    createFakePackage('user', {
      name: 'user-package',
      version: '1.0.0'
    });
    createFakePackage('dev', {
      name: 'dev-package',
      version: '1.0.0'
    });
    createFakePackage('git', {
      name: 'git-package',
      version: '1.0.0',
      apmInstallSource: {
        type: 'git',
        source: 'git+ssh://git@github.com:user/repo.git',
        sha: 'abcdef1234567890'
      }
    });

    const badPackagePath = path.join(process.env.ATOM_HOME, 'packages', '.bin');
    fs.makeTreeSync(badPackagePath);
    fs.writeFileSync(path.join(badPackagePath, 'file.txt'), 'some fake stuff');
  });

  afterEach(() => {
    console.log.calls.reset();
  });

  it('lists the installed packages', async () => {
    await listPackages();
    const lines = console.log.calls.allArgs().map(arr => arr.join(' '));
    expect(lines[0]).toMatch(/Built-in Atom Packages.*1/);
    expect(lines[1]).toMatch(/test-module@1\.0\.0/);
    expect(lines[3]).toMatch(/Dev Packages.*1/);
    expect(lines[4]).toMatch(/dev-package@1\.0\.0/);
    expect(lines[6]).toMatch(/Community Packages.*1/);
    expect(lines[7]).toMatch(/user-package@1\.0\.0/);
    expect(lines[9]).toMatch(/Git Packages.*1/);
    expect(lines[10]).toMatch(/git-package@1\.0\.0/);
    expect(lines.join('\n')).not.toContain('.bin');
  }); // ensure invalid packages aren't listed

  it('lists the installed packages without versions with --no-versions', async () => {
    await listPackages('--no-versions');
    const lines = console.log.calls.allArgs().map(arr => arr.join(' '));
    expect(lines[0]).toMatch(/Built-in Atom Packages.*1/);
    expect(lines[1]).toMatch(/test-module/);
    expect(lines[3]).toMatch(/Dev Packages.*1/);
    expect(lines[4]).toMatch(/dev-package/);
    expect(lines[6]).toMatch(/Community Packages.*1/);
    expect(lines[7]).toMatch(/user-package/);
    expect(lines[9]).toMatch(/Git Packages.*1/);
    expect(lines[10]).toMatch(/git-package/);
    expect(lines.join('\n')).not.toContain('.bin');
  }); // ensure invalid packages aren't listed

  describe('enabling and disabling packages', () => {
    beforeEach(async () => {
      const packagesPath = path.join(atomHome, 'packages');
      fs.makeTreeSync(packagesPath);
      await fsPromises.cp(
        path.join(__dirname, 'fixtures', 'test-module'),
        path.join(packagesPath, 'test-module'),
        { recursive: true }
      );
      const configPath = path.join(atomHome, 'config.cson');
      CSON.writeFileSync(configPath, {
        '*': {
          core: {
            disabledPackages: ['test-module']
          }
        }
      });
    });

    it('labels disabled packages', async () => {
      await listPackages();
      expect(console.log.calls.argsFor(1)[0]).toContain('test-module@1.0.0 (disabled)');
    });

    it('displays only disabled packages when --disabled is called', async () => {
      await listPackages('--disabled');
      expect(console.log.calls.argsFor(1)[0]).toMatch(/test-module@1\.0\.0$/);
      expect(console.log.calls.allArgs().toString()).not.toContain(['user-package']);
    });

    it('displays only enabled packages when --enabled is called', async () => {
      await listPackages('--enabled');
      expect(console.log.calls.argsFor(7)[0]).toMatch(/user-package@1\.0\.0$/);
      expect(console.log.calls.allArgs().toString()).not.toContain(['test-module']);
    });
  });

  it('lists packages in json format when --json is passed', async () => {
    await listPackages('--json');
    const json = JSON.parse(console.log.calls.allArgs()[0][0]);
    const apmInstallSource = {
      type: 'git',
      source: 'git+ssh://git@github.com:user/repo.git',
      sha: 'abcdef1234567890'
    };
    expect(json.core).toEqual([{name: 'test-module', version: '1.0.0'}]);
    expect(json.dev).toEqual([{name: 'dev-package', version: '1.0.0'}]);
    expect(json.git).toEqual([{name: 'git-package', version: '1.0.0', apmInstallSource}]);
    expect(json.user).toEqual([{name: 'user-package', version: '1.0.0'}]);
  });

  it('lists packages in bare format when --bare is passed', async () => {
    await listPackages('--bare');
    const lines = console.log.calls.allArgs().map(arr => arr.join(' '));
    expect(lines[0]).toMatch(/test-module@1\.0\.0/);
    expect(lines[1]).toMatch(/dev-package@1\.0\.0/);
    expect(lines[2]).toMatch(/user-package@1\.0\.0/);
    expect(lines[3]).toMatch(/git-package@1\.0\.0/);
  });

  it('list packages in bare format without versions when --bare --no-versions is passed', async () => {
    await listPackages('--bare', '--no-versions');
    const lines = console.log.calls.allArgs().map(arr => arr.join(' '));
    expect(lines[0]).toMatch(/test-module/);
    expect(lines[1]).toMatch(/dev-package/);
    expect(lines[2]).toMatch(/user-package/);
    expect(lines[3]).toMatch(/git-package/);
  });

  describe('when a section is empty', () => {
    it('does not list anything for Dev and Git sections', async () => {
      removeFakePackage('git', 'git-package');
      removeFakePackage('dev', 'dev-package');
      await listPackages();
      const output = console.log.calls.allArgs().map(arr => arr.join(' ')).join('\n');
      expect(output).not.toMatch(/Git Packages/);
      expect(output).not.toMatch(/git-package/);
      expect(output).not.toMatch(/Dev Packages.*1/);
      expect(output).not.toMatch(/dev-package@1\.0\.0/);
      expect(output).not.toMatch(/(empty)/);
    });

    it('displays "empty" for User section', async () => {
      removeFakePackage('user', 'user-package');
      await listPackages();
      const lines = console.log.calls.allArgs().map(arr => arr.join(' '));
      expect(lines[0]).toMatch(/Built-in Atom Packages.*1/);
      expect(lines[1]).toMatch(/test-module@1\.0\.0/);
      expect(lines[3]).toMatch(/Dev Packages.*1/);
      expect(lines[4]).toMatch(/dev-package@1\.0\.0/);
      expect(lines[6]).toMatch(/Community Packages.*0/);
      expect(lines[7]).toMatch(/(empty)/);
      expect(lines[9]).toMatch(/Git Packages.*1/);
      expect(lines[10]).toMatch(/git-package@1\.0\.0/);
      expect(lines.join('\n')).not.toContain('.bin');
    });
  });
}); // ensure invalid packages aren't listed
