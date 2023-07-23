const path = require('path');
const fs = require('fs-plus');
const temp = require('temp');
const apm = require('../src/apm-cli');

const createPackage = (packageName, includeDev) => {
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
  return {packagePath, devPackagePath};
};

describe('apm uninstall', () => {
  beforeEach(() => {
    silenceOutput();
    spyOnToken();
    process.env.ATOM_API_URL = 'http://localhost:5432';
  });

  describe('when no package is specified', () => {
    it('logs an error and exits', () => {
      const callback = jasmine.createSpy('callback');
      apm.run(['uninstall'], callback);

      waitsFor('waiting for command to complete', () => callback.callCount > 0);

      runs(() => {
        expect(console.error.mostRecentCall.args[0].length).toBeGreaterThan(0);
        expect(callback.mostRecentCall.args[0]).not.toBeUndefined();
      });
    });
  });

  describe('when the package is not installed', () => {
    it('ignores the package', () => {
      const callback = jasmine.createSpy('callback');
      apm.run(['uninstall', 'a-package-that-does-not-exist'], callback);

      waitsFor('waiting for command to complete', () => callback.callCount > 0);

      runs(() => {
        expect(console.error.callCount).toBe(1);
      });
    });
  });

  describe('when the package is installed', () => {
    it('deletes the package', () => {
      const {packagePath} = createPackage('test-package');

      expect(fs.existsSync(packagePath)).toBeTruthy();
      const callback = jasmine.createSpy('callback');
      apm.run(['uninstall', 'test-package'], callback);

      waitsFor('waiting for command to complete', () => callback.callCount > 0);

      runs(() => {
        expect(fs.existsSync(packagePath)).toBeFalsy();
      });
    });
  });

  describe('when the package folder exists but does not contain a package.json', () => {
    it('does not delete the folder', () => {
      const {packagePath} = createPackage('test-package');
      fs.unlinkSync(path.join(packagePath, 'package.json'));

      const callback = jasmine.createSpy('callback');
      apm.run(['uninstall', 'test-package'], callback);

      waitsFor('waiting for command to complete', () => callback.callCount > 0);

      runs(() => expect(fs.existsSync(packagePath)).toBeTruthy());
    });

    describe('when . is specified as the package name', () => {
      it('resolves to the basename of the cwd', () => {
        const {packagePath} = createPackage('test-package');

        expect(fs.existsSync(packagePath)).toBeTruthy();

        const oldCwd = process.cwd();
        process.chdir(packagePath);

        const callback = jasmine.createSpy('callback');
        apm.run(['uninstall', '.'], callback);

        waitsFor('waiting for command to complete', () => callback.callCount > 0);

        runs(() => {
          expect(fs.existsSync(packagePath)).toBeFalsy();
          process.chdir(oldCwd);
        });
      });
    });

    describe('--dev', () => {
      it('deletes the packages from the dev packages folder', () => {
        const {packagePath, devPackagePath} = createPackage('test-package', true);

        expect(fs.existsSync(packagePath)).toBeTruthy();
        const callback = jasmine.createSpy('callback');
        apm.run(['uninstall', 'test-package', '--dev'], callback);

        waitsFor('waiting for command to complete', () => callback.callCount > 0);

        runs(() => {
          expect(fs.existsSync(devPackagePath)).toBeFalsy();
          expect(fs.existsSync(packagePath)).toBeTruthy();
        });
      });
    });

    describe('--hard', () => {
      it('deletes the packages from the both packages folders', () => {
        const atomHome = temp.mkdirSync('apm-home-dir-');
        const packagePath = path.join(atomHome, 'packages', 'test-package');
        fs.makeTreeSync(path.join(packagePath, 'lib'));
        fs.writeFileSync(path.join(packagePath, 'package.json'), '{}');
        const devPackagePath = path.join(atomHome, 'dev', 'packages', 'test-package');
        fs.makeTreeSync(path.join(devPackagePath, 'lib'));
        fs.writeFileSync(path.join(devPackagePath, 'package.json'), '{}');
        process.env.ATOM_HOME = atomHome;

        expect(fs.existsSync(packagePath)).toBeTruthy();
        const callback = jasmine.createSpy('callback');
        apm.run(['uninstall', 'test-package', '--hard'], callback);

        waitsFor('waiting for command to complete', () => callback.callCount > 0);

        runs(() => {
          expect(fs.existsSync(devPackagePath)).toBeFalsy();
          expect(fs.existsSync(packagePath)).toBeFalsy();
        });
      });
    });
  });
});
