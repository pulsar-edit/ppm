const path = require('path');
const fs = require('fs-plus');
const temp = require('temp');

function createPackage (packageName, includeDev) {
  let devPackagePath;
  if (includeDev == null) {
    includeDev = false;
  }
  const atomHome = temp.mkdirSync('apm-home-dir-');
  const packagePath = path.join(atomHome, 'packages', packageName);
  fs.makeTreeSync(path.join(packagePath, 'lib'));
  fs.writeFileSync(path.join(packagePath, 'package.json'), '{}');
  if (includeDev) {
    devPackagePath = path.join(atomHome, 'dev', 'packages', packageName);
    fs.makeTreeSync(path.join(devPackagePath, 'lib'));
    fs.writeFileSync(path.join(devPackagePath, 'package.json'), '{}');
  }
  process.env.ATOM_HOME = atomHome;
  return { packagePath, devPackagePath };
}

describe('apm uninstall', () => {
  beforeEach(() => {
    silenceOutput(true);
    spyOnToken();
    process.env.ATOM_API_URL = 'http://localhost:5432';
  });

  describe('when no package is specified', () => {
    it('logs an error and exits', async () => {
      const callback = jasmine.createSpy('callback');
      await apmRun(['uninstall'], callback);

      expect(console.error.calls.mostRecent().args[0].length).toBeGreaterThan(0);
      expect(callback.calls.mostRecent().args[0]).not.toBeUndefined();
    });
  });

  describe('when the package is not installed', () => {
    it('ignores the package', async () => {
      await apmRun(['uninstall', 'a-package-that-does-not-exist']);

      expect(console.error.calls.count()).toBe(1);
    });
  });

  describe('when the package is installed', () => {
    it('deletes the package', async () => {
      const { packagePath } = createPackage('test-package');

      expect(fs.existsSync(packagePath)).toBeTruthy();
      await apmRun(['uninstall', 'test-package']);

      expect(fs.existsSync(packagePath)).toBeFalsy();
    });
  });

  describe('when the package folder exists but does not contain a package.json', () => {
    it('does not delete the folder', async () => {
      const { packagePath } = createPackage('test-package');
      fs.unlinkSync(path.join(packagePath, 'package.json'));

      await apmRun(['uninstall', 'test-package']);

      expect(fs.existsSync(packagePath)).toBeTruthy();
    });

    describe('when . is specified as the package name', () => {
      it('resolves to the basename of the cwd', async () => {
        const { packagePath } = createPackage('test-package');

        expect(fs.existsSync(packagePath)).toBeTruthy();

        const oldCwd = process.cwd();
        process.chdir(packagePath);

        await apmRun(['uninstall', '.']);

        expect(fs.existsSync(packagePath)).toBeFalsy();
        process.chdir(oldCwd);
      });
    });

    describe('--dev', () => {
      it('deletes the packages from the dev packages folder', async () => {
        const { packagePath, devPackagePath } = createPackage('test-package', true);

        expect(fs.existsSync(packagePath)).toBeTruthy();
        await apmRun(['uninstall', 'test-package', '--dev']);

        expect(fs.existsSync(devPackagePath)).toBeFalsy();
        expect(fs.existsSync(packagePath)).toBeTruthy();
      });
    });

    describe('--hard', () => {
      it('deletes the packages from the both packages folders', async () => {
        const atomHome = temp.mkdirSync('apm-home-dir-');
        const packagePath = path.join(atomHome, 'packages', 'test-package');
        fs.makeTreeSync(path.join(packagePath, 'lib'));
        fs.writeFileSync(path.join(packagePath, 'package.json'), '{}');
        const devPackagePath = path.join(atomHome, 'dev', 'packages', 'test-package');
        fs.makeTreeSync(path.join(devPackagePath, 'lib'));
        fs.writeFileSync(path.join(devPackagePath, 'package.json'), '{}');
        process.env.ATOM_HOME = atomHome;

        expect(fs.existsSync(packagePath)).toBeTruthy();
        await apmRun(['uninstall', 'test-package', '--hard']);

        expect(fs.existsSync(devPackagePath)).toBeFalsy();
        expect(fs.existsSync(packagePath)).toBeFalsy();
      });
    });
  });
});
