const path = require('path');
const fs = require('fs-plus');
const temp = require('temp');
const Develop = require('../src/develop');

describe('apm develop', () => {
  let linkedRepoPath, repoPath;

  beforeEach(() => {
    silenceOutput();
    spyOnToken();
    const atomHome = temp.mkdirSync('apm-home-dir-');
    process.env.ATOM_HOME = atomHome;
    const atomReposHome = temp.mkdirSync('apm-repos-home-dir-');
    process.env.ATOM_REPOS_HOME = atomReposHome;
    repoPath = path.join(atomReposHome, 'fake-package');
    linkedRepoPath = path.join(atomHome, 'dev', 'packages', 'fake-package');
  });

  describe("when the package doesn't have a published repository url", () => {
    it('logs an error', async () => {
      spyOn(Develop.prototype, 'getRepositoryUrl').and.callFake(
        _packageName => Promise.reject('Here is the error')
      );
      const callback = jasmine.createSpy('callback');
      await apmRun(['develop', 'fake-package'], callback);
      expect(callback.calls.mostRecent().args[0]).toBe('Here is the error');
      expect(fs.existsSync(repoPath)).toBeFalsy();
      expect(fs.existsSync(linkedRepoPath)).toBeFalsy();
    });
  });

  describe("when the repository hasn't been cloned", () => {
    it('clones the repository to ATOM_REPOS_HOME and links it to ATOM_HOME/dev/packages', async () => {
      spyOn(Develop.prototype, 'getRepositoryUrl').and.callFake(_packageName => {
        const repoUrl = path.join(__dirname, 'fixtures', 'repo.git');
        return Promise.resolve(repoUrl);
      });
      spyOn(Develop.prototype, 'installDependencies').and.callFake(
        function (packageDirectory, options) {
          return this.linkPackage(packageDirectory, options);
        }
      );
      const callback = jasmine.createSpy('callback');
      await apmRun(['develop', 'fake-package'], callback);
      expect(callback.calls.mostRecent().args[0]).toBeFalsy();
      expect(fs.existsSync(repoPath)).toBeTruthy();
      expect(fs.existsSync(path.join(repoPath, 'Syntaxes', 'Makefile.plist'))).toBeTruthy();
      expect(fs.existsSync(linkedRepoPath)).toBeTruthy();
      expect(fs.realpathSync(linkedRepoPath)).toBe(fs.realpathSync(repoPath));
    });
  });

  describe('when the repository has already been cloned', () => {
    it('links it to ATOM_HOME/dev/packages', async () => {
      fs.makeTreeSync(repoPath);
      fs.writeFileSync(path.join(repoPath, 'package.json'), '');
      const callback = jasmine.createSpy('callback');
      await apmRun(['develop', 'fake-package'], callback);
      expect(callback.calls.mostRecent().args[0]).toBeFalsy();
      expect(fs.existsSync(repoPath)).toBeTruthy();
      expect(fs.existsSync(linkedRepoPath)).toBeTruthy();
      expect(fs.realpathSync(linkedRepoPath)).toBe(fs.realpathSync(repoPath));
    });
  });
});
