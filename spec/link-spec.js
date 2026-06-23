const fs = require('fs');
const path = require('path');
const temp = require('temp');

describe('apm link/unlink', () => {
  beforeEach(() => {
    silenceOutput();
    spyOnToken();
  });

  describe('when the dev flag is false (the default)', () => {
    it('symlinks packages to $ATOM_HOME/packages', async () => {
      const atomHome = temp.mkdirSync('apm-home-dir-');
      process.env.ATOM_HOME = atomHome;
      const packageToLink = temp.mkdirSync('a-package-');
      process.chdir(packageToLink);

      await apmRun(['link']);

      expect(
        fs.existsSync(path.join(atomHome, 'packages', path.basename(packageToLink)))
      ).toBeTruthy();
      expect(
        fs.realpathSync(path.join(atomHome, 'packages', path.basename(packageToLink)))
      ).toBe(fs.realpathSync(packageToLink));

      await apmRun(['unlink']);

      expect(
        fs.existsSync(
          path.join(atomHome, 'packages', path.basename(packageToLink))
        )
      ).toBeFalsy();
    });
  });

  describe('when the dev flag is true', () => {
    it('symlinks packages to $ATOM_HOME/dev/packages', async () => {
      const atomHome = temp.mkdirSync('apm-home-dir-');
      process.env.ATOM_HOME = atomHome;
      const packageToLink = temp.mkdirSync('a-package-');
      process.chdir(packageToLink);

      await apmRun(['link', '--dev']);

      expect(
        fs.existsSync(path.join(atomHome, 'dev', 'packages', path.basename(packageToLink)))
      ).toBeTruthy();
      expect(fs.realpathSync(
        path.join(atomHome, 'dev', 'packages', path.basename(packageToLink)))
      ).toBe(fs.realpathSync(packageToLink));

      await apmRun(['unlink', '--dev']);

      expect(
        fs.existsSync(
          path.join(atomHome, 'dev', 'packages', path.basename(packageToLink))
        )
      ).toBeFalsy();
    });
  });

  describe('when linking a path that already exists', () => {
    it('logs an error and exits', async () => {
      const atomHome = temp.mkdirSync('apm-home-dir-');
      process.env.ATOM_HOME = atomHome;
      const packageToLink = temp.mkdirSync('a-package-');

      const existingPackageDir = path.join(atomHome, 'packages', path.basename(packageToLink));
      fs.mkdirSync(existingPackageDir, {recursive: true});
      fs.writeFileSync(path.join(existingPackageDir, 'foo.txt'), '');

      fs.writeFileSync(path.join(packageToLink, 'bar.txt'), '');
      process.chdir(packageToLink);
      const callback = jasmine.createSpy('callback');

      await apmRun(['link'], callback);

      expect(console.error.calls.mostRecent().args[0].length).toBeGreaterThan(0);
      expect(callback.calls.mostRecent().args[0]).not.toBeUndefined();

      expect(fs.existsSync(path.join(existingPackageDir, 'foo.txt'))).toBeTruthy();
      expect(fs.existsSync(path.join(existingPackageDir, 'bar.txt'))).toBeFalsy();
    });

    it('overwrites the path if the --force flag is passed', async () => {
      const atomHome = temp.mkdirSync('apm-home-dir-');
      process.env.ATOM_HOME = atomHome;
      const packageToLink = temp.mkdirSync('a-package-');

      const existingPackageDir = path.join(atomHome, 'packages', path.basename(packageToLink));
      fs.mkdirSync(existingPackageDir, {recursive: true});
      fs.writeFileSync(path.join(existingPackageDir, 'foo.txt'), '');

      fs.writeFileSync(path.join(packageToLink, 'bar.txt'), '');
      process.chdir(packageToLink);

      await apmRun(['link', '--force']);

      expect(fs.existsSync(existingPackageDir)).toBeTruthy();
      expect(fs.realpathSync(existingPackageDir)).toBe(fs.realpathSync(packageToLink));
      expect(fs.existsSync(path.join(existingPackageDir, 'foo.txt'))).toBeFalsy();
      expect(fs.existsSync(path.join(existingPackageDir, 'bar.txt'))).toBeTruthy();
    });
  });

  describe('when the hard flag is true', () => {
    it('unlinks the package from both $ATOM_HOME/packages and $ATOM_HOME/dev/packages', async () => {
      const atomHome = temp.mkdirSync('apm-home-dir-');
      process.env.ATOM_HOME = atomHome;
      const packageToLink = temp.mkdirSync('a-package-');
      process.chdir(packageToLink);

      await apmRun(['link', '--dev']);
      await apmRun(['link']);
      await apmRun(['unlink', '--hard']);

      expect(fs.existsSync(
        path.join(atomHome, 'dev', 'packages', path.basename(packageToLink)))
      ).toBeFalsy();
      expect(fs.existsSync(
        path.join(atomHome, 'packages', path.basename(packageToLink)))
      ).toBeFalsy();
    });
  });

  describe('when the all flag is true', () => {
    it('unlinks all packages in $ATOM_HOME/packages and $ATOM_HOME/dev/packages', async () => {
      const atomHome = temp.mkdirSync('apm-home-dir-');
      process.env.ATOM_HOME = atomHome;
      const packageToLink1 = temp.mkdirSync('a-package-');
      const packageToLink2 = temp.mkdirSync('a-package-');
      const packageToLink3 = temp.mkdirSync('a-package-');
      const callback = jasmine.createSpy('callback');

      await apmRun(['link', '--dev', packageToLink1], callback);
      await apmRun(['link', packageToLink2], callback);
      await apmRun(['link', packageToLink3], callback);

      expect(fs.existsSync(
        path.join(atomHome, 'dev', 'packages', path.basename(packageToLink1)))
      ).toBeTruthy();
      expect(fs.existsSync(
        path.join(atomHome, 'packages', path.basename(packageToLink2)))
      ).toBeTruthy();
      expect(fs.existsSync(
        path.join(atomHome, 'packages', path.basename(packageToLink3)))
      ).toBeTruthy();

      await apmRun(['unlink', '--all']);

      expect(fs.existsSync(
        path.join(atomHome, 'dev', 'packages', path.basename(packageToLink1)))
      ).toBeFalsy();
      expect(fs.existsSync(
        path.join(atomHome, 'packages', path.basename(packageToLink2)))
      ).toBeFalsy();
      expect(fs.existsSync(
        path.join(atomHome, 'packages', path.basename(packageToLink3)))
      ).toBeFalsy();
    });
  });

  describe('when the package name is numeric', () => {
    it('still links and unlinks normally', async () => {
      const atomHome = temp.mkdirSync('apm-home-dir-');
      process.env.ATOM_HOME = atomHome;
      const numericPackageName = temp.mkdirSync('42');
      const callback = jasmine.createSpy('callback');

      await apmRun(['link', numericPackageName]);

      expect(
        fs.existsSync(path.join(atomHome, 'packages', path.basename(numericPackageName)))
      ).toBeTruthy();
      expect(
        fs.realpathSync(
          path.join(atomHome, 'packages', path.basename(numericPackageName))
        )
      ).toBe(fs.realpathSync(numericPackageName));

      await apmRun(['unlink', numericPackageName], callback);

      expect(
        fs.existsSync(
          path.join(atomHome, 'packages', path.basename(numericPackageName))
        )
      ).toBeFalsy();
    });
  });

  describe('when the package name is set after --name', () => {
    it('still links and unlinks normally', async () => {
      const atomHome = temp.mkdirSync('apm-home-dir-');
      process.env.ATOM_HOME = atomHome;
      const packagePath = temp.mkdirSync('new-package');
      const packageName = 'new-package-name';

      await apmRun(['link', packagePath, '--name', packageName]);

      expect(fs.existsSync(path.join(atomHome, 'packages', packageName))).toBeTruthy();
      expect(fs.realpathSync(path.join(atomHome, 'packages', packageName))).toBe(fs.realpathSync(packagePath));

      await apmRun(['unlink', packageName]);

      expect(
        fs.existsSync(path.join(atomHome, 'packages', packageName))
      ).toBeFalsy();
    });
  });

  describe('when unlinking a path that is not a symbolic link', () => {
    it('logs an error and exits', async () => {
      const callback = jasmine.createSpy('callback');
      process.chdir(temp.mkdirSync('not-a-symlink'));
      await apmRun(['unlink'], callback);

      expect(console.error.calls.mostRecent().args[0].length).toBeGreaterThan(0);
      expect(callback.calls.mostRecent().args[0]).not.toBeUndefined();
    });
  });

  describe('when unlinking a path that does not exist', () => {
    it('logs an error and exits', async () => {
      const callback = jasmine.createSpy('callback');
      await apmRun(['unlink', 'a-path-that-does-not-exist'], callback);

      expect(console.error.calls.mostRecent().args[0].length).toBeGreaterThan(0);
      expect(callback.calls.mostRecent().args[0]).not.toBeUndefined();
    });
  });
});
