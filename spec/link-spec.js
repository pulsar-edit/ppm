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

      runs(async () => {
        await apm.run(['link']).then(callback, callback);
      });

      waitsFor('waiting for link to complete', () => callback.callCount > 0);

      runs(async () => {
        expect(fs.existsSync(path.join(atomHome, 'packages', path.basename(packageToLink)))).toBeTruthy();
        expect(fs.realpathSync(path.join(atomHome, 'packages', path.basename(packageToLink)))).toBe(fs.realpathSync(packageToLink));

        callback.reset();
        await apm.run(['unlink']).then(callback, callback);
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

      runs(async () => {
        await apm.run(['link', '--dev']).then(callback, callback);
      });

      waitsFor('waiting for link to complete', () => callback.callCount > 0);

      runs(async () => {
        expect(fs.existsSync(path.join(atomHome, 'dev', 'packages', path.basename(packageToLink)))).toBeTruthy();
        expect(fs.realpathSync(path.join(atomHome, 'dev', 'packages', path.basename(packageToLink)))).toBe(fs.realpathSync(packageToLink));

        callback.reset();
        await apm.run(['unlink', '--dev']).then(callback, callback);
      });

      waitsFor('waiting for unlink to complete', () => callback.callCount > 0);

      runs(() => {
        expect(fs.existsSync(path.join(atomHome, 'dev', 'packages', path.basename(packageToLink)))).toBeFalsy();
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

      runs(async () => {
        await apm.run(['link', '--dev']).then(callback, callback);
      });

      waitsFor('link --dev to complete', () => callback.callCount === 1);

      runs(async () => {
        await apm.run(['link']).then(callback, callback);
      });

      waitsFor('link to complete', () => callback.callCount === 2);

      runs(async () => {
        await apm.run(['unlink', '--hard']).then(callback, callback);
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

      runs(async () => {
        await apm.run(['link', '--dev', packageToLink1]).then(callback, callback);
      });

      waitsFor('link --dev to complete', () => callback.callCount === 1);

      runs(async () => {
        callback.reset();
        await apm.run(['link', packageToLink2]).then(callback, callback);
        await apm.run(['link', packageToLink3]).then(callback, callback);
      });

      waitsFor('link to complee', () => callback.callCount === 2)

      runs(async () => {
        callback.reset();
        expect(fs.existsSync(path.join(atomHome, 'dev', 'packages', path.basename(packageToLink1)))).toBeTruthy();
        expect(fs.existsSync(path.join(atomHome, 'packages', path.basename(packageToLink2)))).toBeTruthy();
        expect(fs.existsSync(path.join(atomHome, 'packages', path.basename(packageToLink3)))).toBeTruthy();
        await apm.run(['unlink', '--all']).then(callback, callback);
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

      runs(async () => {
        await apm.run(['link', numericPackageName]).then(callback, callback);
      });

      waitsFor('link to complete', () => callback.callCount === 1);

      runs(async () => {
        expect(fs.existsSync(path.join(atomHome, 'packages', path.basename(numericPackageName)))).toBeTruthy();
        expect(fs.realpathSync(path.join(atomHome, 'packages', path.basename(numericPackageName)))).toBe(fs.realpathSync(numericPackageName));

        callback.reset();
        await apm.run(['unlink', numericPackageName]).then(callback, callback);
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

      runs(async () => {
        await apm.run(['link', packagePath, '--name', packageName]).then(callback, callback);
      });

      waitsFor('link to complete', () => callback.callCount === 1);

      runs(async () => {
        expect(fs.existsSync(path.join(atomHome, 'packages', packageName))).toBeTruthy();
        expect(fs.realpathSync(path.join(atomHome, 'packages', packageName))).toBe(fs.realpathSync(packagePath));

        callback.reset();
        await apm.run(['unlink', packageName]).then(callback, callback);
      });

      waitsFor('unlink to complete', () => callback.callCount === 1);

      runs(() => {
        expect(fs.existsSync(path.join(atomHome, 'packages', packageName))).toBeFalsy();
      });
    });
  });

  describe('when unlinking a path that is not a symbolic link', () => {
    it('logs an error and exits', async () => {
      const callback = jasmine.createSpy('callback');
      process.chdir(temp.mkdirSync('not-a-symlink'));
      await apm.run(['unlink']).then(callback, callback);

      waitsFor('waiting for command to complete', () => callback.callCount > 0);

      runs(() => {
        expect(console.error.mostRecentCall.args[0].length).toBeGreaterThan(0);
        expect(callback.mostRecentCall.args[0]).not.toBeUndefined();
      });
    });
  });

  describe('when unlinking a path that does not exist', () => {
    it('logs an error and exits', async () => {
      const callback = jasmine.createSpy('callback');
      await apm.run(['unlink', 'a-path-that-does-not-exist']).then(callback, callback);

      waitsFor('waiting for command to complete', () => callback.callCount > 0);

      runs(() => {
        expect(console.error.mostRecentCall.args[0].length).toBeGreaterThan(0);
        expect(callback.mostRecentCall.args[0]).not.toBeUndefined();
      });
    });
  });
});
