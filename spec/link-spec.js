const fs = require('fs');
const path = require('path');
const temp = require('temp');
const apm = require('../src/apm-cli');

describe('apm link/unlink', () => {
  beforeEach(() => {
    silenceOutput();
    spyOnToken();
  });

  describe('when the dev flag is false (the default)', () => {
    it('symlinks packages to $ATOM_HOME/packages', () => {
      const atomHome = temp.mkdirSync('apm-home-dir-');
      process.env.ATOM_HOME = atomHome;
      const packageToLink = temp.mkdirSync('a-package-');
      process.chdir(packageToLink);
      const callback = jasmine.createSpy('callback');

      runs(() => {
        apm.run(['link'], callback);
      });

      waitsFor('waiting for link to complete', () => callback.callCount > 0);

      runs(() => {
        expect(fs.existsSync(path.join(atomHome, 'packages', path.basename(packageToLink)))).toBeTruthy();
        expect(fs.realpathSync(path.join(atomHome, 'packages', path.basename(packageToLink)))).toBe(fs.realpathSync(packageToLink));

        callback.reset();
        apm.run(['unlink'], callback);
      });

      waitsFor('waiting for unlink to complete', () => callback.callCount > 0);

      runs(() => {
        expect(fs.existsSync(path.join(atomHome, 'packages', path.basename(packageToLink)))).toBeFalsy();
      });
    });
  });

  describe('when the dev flag is true', () => {
    it('symlinks packages to $ATOM_HOME/dev/packages', () => {
      const atomHome = temp.mkdirSync('apm-home-dir-');
      process.env.ATOM_HOME = atomHome;
      const packageToLink = temp.mkdirSync('a-package-');
      process.chdir(packageToLink);
      const callback = jasmine.createSpy('callback');

      runs(() => {
        apm.run(['link', '--dev'], callback);
      });

      waitsFor('waiting for link to complete', () => callback.callCount > 0);

      runs(() => {
        expect(fs.existsSync(path.join(atomHome, 'dev', 'packages', path.basename(packageToLink)))).toBeTruthy();
        expect(fs.realpathSync(path.join(atomHome, 'dev', 'packages', path.basename(packageToLink)))).toBe(fs.realpathSync(packageToLink));

        callback.reset();
        apm.run(['unlink', '--dev'], callback);
      });

      waitsFor('waiting for unlink to complete', () => callback.callCount > 0);

      runs(() => {
        expect(fs.existsSync(path.join(atomHome, 'dev', 'packages', path.basename(packageToLink)))).toBeFalsy();
      });
    });
  });

  describe('when linking a path that already exists', () => {
    it('logs an error and exits', () => {
      const atomHome = temp.mkdirSync('apm-home-dir-');
      process.env.ATOM_HOME = atomHome;
      const packageToLink = temp.mkdirSync('a-package-');

      const existingPackageDir = path.join(atomHome, 'packages', path.basename(packageToLink));
      fs.mkdirSync(existingPackageDir, {recursive: true});
      fs.writeFileSync(path.join(existingPackageDir, 'foo.txt'), '');

      fs.writeFileSync(path.join(packageToLink, 'bar.txt'), '');
      process.chdir(packageToLink);
      const callback = jasmine.createSpy('callback');

      apm.run(['link'], callback);
      waitsFor('command to complete', () => callback.callCount > 0);

      runs(() => {
        expect(console.error.mostRecentCall.args[0].length).toBeGreaterThan(0);
        expect(callback.mostRecentCall.args[0]).not.toBeUndefined();

        expect(fs.existsSync(path.join(existingPackageDir, 'foo.txt'))).toBeTruthy();
        expect(fs.existsSync(path.join(existingPackageDir, 'bar.txt'))).toBeFalsy();
      });
    });

    it('overwrites the path if the --force flag is passed', () => {
      const atomHome = temp.mkdirSync('apm-home-dir-');
      process.env.ATOM_HOME = atomHome;
      const packageToLink = temp.mkdirSync('a-package-');

      const existingPackageDir = path.join(atomHome, 'packages', path.basename(packageToLink));
      fs.mkdirSync(existingPackageDir, {recursive: true});
      fs.writeFileSync(path.join(existingPackageDir, 'foo.txt'), '');

      fs.writeFileSync(path.join(packageToLink, 'bar.txt'), '');
      process.chdir(packageToLink);
      const callback = jasmine.createSpy('callback');

      apm.run(['link', '--force'], callback);
      waitsFor('command to complete', () => callback.callCount > 0);

      runs(() => {
        expect(fs.existsSync(existingPackageDir)).toBeTruthy();
        expect(fs.realpathSync(existingPackageDir)).toBe(fs.realpathSync(packageToLink));
        expect(fs.existsSync(path.join(existingPackageDir, 'foo.txt'))).toBeFalsy();
        expect(fs.existsSync(path.join(existingPackageDir, 'bar.txt'))).toBeTruthy();
      });
    });
  });

  describe('when the hard flag is true', () => {
    it('unlinks the package from both $ATOM_HOME/packages and $ATOM_HOME/dev/packages', () => {
      const atomHome = temp.mkdirSync('apm-home-dir-');
      process.env.ATOM_HOME = atomHome;
      const packageToLink = temp.mkdirSync('a-package-');
      process.chdir(packageToLink);
      const callback = jasmine.createSpy('callback');

      runs(() => {
        apm.run(['link', '--dev'], callback);
      });

      waitsFor('link --dev to complete', () => callback.callCount === 1);

      runs(() => {
        apm.run(['link'], callback);
      });

      waitsFor('link to complete', () => callback.callCount === 2);

      runs(() => {
        apm.run(['unlink', '--hard'], callback);
      });

      waitsFor('unlink --hard to complete', () => callback.callCount === 3);

      runs(() => {
        expect(fs.existsSync(path.join(atomHome, 'dev', 'packages', path.basename(packageToLink)))).toBeFalsy();
        expect(fs.existsSync(path.join(atomHome, 'packages', path.basename(packageToLink)))).toBeFalsy();
      });
    });
  });

  describe('when the all flag is true', () => {
    it('unlinks all packages in $ATOM_HOME/packages and $ATOM_HOME/dev/packages', () => {
      const atomHome = temp.mkdirSync('apm-home-dir-');
      process.env.ATOM_HOME = atomHome;
      const packageToLink1 = temp.mkdirSync('a-package-');
      const packageToLink2 = temp.mkdirSync('a-package-');
      const packageToLink3 = temp.mkdirSync('a-package-');
      const callback = jasmine.createSpy('callback');

      runs(() => {
        apm.run(['link', '--dev', packageToLink1], callback);
      });

      waitsFor('link --dev to complete', () => callback.callCount === 1);

      runs(() => {
        callback.reset();
        apm.run(['link', packageToLink2], callback);
        apm.run(['link', packageToLink3], callback);
      });

      waitsFor('link to complee', () => callback.callCount === 2)

      runs(() => {
        callback.reset();
        expect(fs.existsSync(path.join(atomHome, 'dev', 'packages', path.basename(packageToLink1)))).toBeTruthy();
        expect(fs.existsSync(path.join(atomHome, 'packages', path.basename(packageToLink2)))).toBeTruthy();
        expect(fs.existsSync(path.join(atomHome, 'packages', path.basename(packageToLink3)))).toBeTruthy();
        apm.run(['unlink', '--all'], callback);
      })

      waitsFor('unlink --all to complete', () => callback.callCount === 1);

      runs(() => {
        expect(fs.existsSync(path.join(atomHome, 'dev', 'packages', path.basename(packageToLink1)))).toBeFalsy();
        expect(fs.existsSync(path.join(atomHome, 'packages', path.basename(packageToLink2)))).toBeFalsy();
        expect(fs.existsSync(path.join(atomHome, 'packages', path.basename(packageToLink3)))).toBeFalsy();
      });
    });
  });

  describe('when the package name is numeric', () => {
    it('still links and unlinks normally', () => {
      const atomHome = temp.mkdirSync('apm-home-dir-');
      process.env.ATOM_HOME = atomHome;
      const numericPackageName = temp.mkdirSync('42');
      const callback = jasmine.createSpy('callback');

      runs(() => {
        apm.run(['link', numericPackageName], callback);
      });

      waitsFor('link to complete', () => callback.callCount === 1);

      runs(() => {
        expect(fs.existsSync(path.join(atomHome, 'packages', path.basename(numericPackageName)))).toBeTruthy();
        expect(fs.realpathSync(path.join(atomHome, 'packages', path.basename(numericPackageName)))).toBe(fs.realpathSync(numericPackageName));

        callback.reset();
        apm.run(['unlink', numericPackageName], callback);
      });

      waitsFor('unlink to complete', () => callback.callCount === 1);

      runs(() => {
        expect(fs.existsSync(path.join(atomHome, 'packages', path.basename(numericPackageName)))).toBeFalsy();
      });
    });
  });

  describe('when the package name is set after --name', () => {
    it('still links and unlinks normally', () => {
      const atomHome = temp.mkdirSync('apm-home-dir-');
      process.env.ATOM_HOME = atomHome;
      const packagePath = temp.mkdirSync('new-package');
      const packageName = 'new-package-name';
      const callback = jasmine.createSpy('callback');

      runs(() => {
        apm.run(['link', packagePath, '--name', packageName], callback);
      });

      waitsFor('link to complete', () => callback.callCount === 1);

      runs(() => {
        expect(fs.existsSync(path.join(atomHome, 'packages', packageName))).toBeTruthy();
        expect(fs.realpathSync(path.join(atomHome, 'packages', packageName))).toBe(fs.realpathSync(packagePath));

        callback.reset();
        apm.run(['unlink', packageName], callback);
      });

      waitsFor('unlink to complete', () => callback.callCount === 1);

      runs(() => {
        expect(fs.existsSync(path.join(atomHome, 'packages', packageName))).toBeFalsy();
      });
    });
  });

  describe('when unlinking a path that is not a symbolic link', () => {
    it('logs an error and exits', () => {
      const callback = jasmine.createSpy('callback');
      process.chdir(temp.mkdirSync('not-a-symlink'));
      apm.run(['unlink'], callback);

      waitsFor('waiting for command to complete', () => callback.callCount > 0);

      runs(() => {
        expect(console.error.mostRecentCall.args[0].length).toBeGreaterThan(0);
        expect(callback.mostRecentCall.args[0]).not.toBeUndefined();
      });
    });
  });

  describe('when unlinking a path that does not exist', () => {
    it('logs an error and exits', () => {
      const callback = jasmine.createSpy('callback');
      apm.run(['unlink', 'a-path-that-does-not-exist'], callback);

      waitsFor('waiting for command to complete', () => callback.callCount > 0);

      runs(() => {
        expect(console.error.mostRecentCall.args[0].length).toBeGreaterThan(0);
        expect(callback.mostRecentCall.args[0]).not.toBeUndefined();
      });
    });
  });
});
