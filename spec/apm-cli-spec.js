const path = require('path');
const temp = require('temp');
const fs = require('fs');
const apm = require('../src/apm-cli');

describe('apm command line interface', () => {
  beforeEach(() => {
    silenceOutput();
    spyOnToken();
  });

  describe('when no arguments are present', () => {
    it('prints a usage message', () => {
      apm.run([]);
      expect(console.log).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
      expect(console.error.calls.argsFor(0)[0].length).toBeGreaterThan(0);
    });
  });

  describe('when the help flag is specified', () => {
    it('prints a usage message', () => {
      apm.run(['-h']);
      expect(console.log).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
      expect(console.error.calls.argsFor(0)[0].length).toBeGreaterThan(0);
    });
  });

  describe('when the version flag is specified', () => {
    it('prints the version', async () => {
      const callback = jasmine.createSpy('callback');
      apm.run(['-v', '--no-color'], callback);
      const testAtomVersion = '0.0.0';
      const tempAtomResourcePath = temp.mkdirSync('apm-resource-dir-');
      fs.writeFileSync(path.join(tempAtomResourcePath, 'package.json'), JSON.stringify({
        version: testAtomVersion
      }));
      process.env.ATOM_RESOURCE_PATH = tempAtomResourcePath;
      await waitsFor(() => callback.calls.count() === 1);
      expect(console.error).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalled();
      const lines = console.log.calls.argsFor(0)[0].split('\n');
      expect(lines[0]).toBe(`ppm  ${require('../package.json').version}`);
      expect(lines[1]).toBe(`npm  ${require('npm/package.json').version}`);
      expect(lines[2]).toBe(`node ${process.versions.node} ${process.arch}`);
      expect(lines[3]).toBe(`pulsar ${testAtomVersion}`);
    });
  });

  describe('when the version flag is specified but env.ATOM_RESOURCE_PATH is not set', () => {
    it('finds the installed Atom and prints the version', async () => {
      const callback = jasmine.createSpy('callback');
      apm.run(['-v', '--no-color'], callback);
      process.env.ATOM_RESOURCE_PATH = '';
      await waitsFor(() => callback.calls.count() === 1);
      expect(console.error).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalled();
      const lines = console.log.calls.argsFor(0)[0].split('\n');
      expect(lines[0]).toBe(`ppm  ${require('../package.json').version}`);
      expect(lines[1]).toBe(`npm  ${require('npm/package.json').version}`);
      expect(lines[2]).toBe(`node ${process.versions.node} ${process.arch}`);
    });

    describe('when the version flag is specified and apm is unable find package.json on the resourcePath', () => {
      it('prints unknown atom version', async () => {
        const callback = jasmine.createSpy('callback');
        apm.run(['-v', '--no-color'], callback);
        const testAtomVersion = 'unknown';
        const tempAtomResourcePath = temp.mkdirSync('apm-resource-dir-');
        process.env.ATOM_RESOURCE_PATH = tempAtomResourcePath;
        await waitsFor(() => callback.calls.count() === 1);
        expect(console.error).not.toHaveBeenCalled();
        expect(console.log).toHaveBeenCalled();
        const lines = console.log.calls.argsFor(0)[0].split('\n');
        expect(lines[3]).toBe(`pulsar ${testAtomVersion}`);
      });
    });
  });

  describe('when an unrecognized command is specified', () => {
    it('prints an error message and exits', () => {
      const callback = jasmine.createSpy('callback');
      apm.run(['this-will-never-be-a-command'], callback);
      expect(console.log).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
      expect(console.error.calls.argsFor(0)[0].length).toBeGreaterThan(0);
      expect(callback.calls.mostRecent().args[0]).not.toBeUndefined();
    });
  });
});
