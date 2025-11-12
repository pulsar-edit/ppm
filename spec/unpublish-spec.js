const express = require('express');
const http = require('http');
const temp = require('temp');
const Unpublish = require('../src/unpublish');

describe('apm unpublish', () => {
  let server, unpublishPackageCallback, unpublishVersionCallback;

  beforeEach(async () => {
    silenceOutput();
    spyOnToken();

    unpublishPackageCallback = jasmine.createSpy('unpublishPackageCallback');
    unpublishVersionCallback = jasmine.createSpy('unpublishVersionCallback');

    const app = express();

    app.delete('/packages/test-package', (_request, response) => {
      unpublishPackageCallback();
      response.status(204).send(204);
    });
    app.delete('/packages/test-package/versions/1.0.0', (_request, response) => {
      unpublishVersionCallback();
      response.status(204).send(204);
    });

    server = http.createServer(app);

    await new Promise((resolve) => {
      server.listen(3000, '127.0.0.1', () => {
        process.env.ATOM_HOME = temp.mkdirSync('apm-home-dir-');
        process.env.ATOM_API_URL = 'http://localhost:3000';
        resolve();
      });
    });
  });

  afterEach(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  describe('when no version is specified', () => {
    it('unpublishes the package', async () => {
      const callback = jasmine.createSpy('callback');
      await apmRun(['unpublish', '--force', 'test-package'], callback);

      expect(callback.calls.argsFor(0)[0]).toBeUndefined();
      expect(unpublishPackageCallback.calls.count()).toBe(1);
      expect(unpublishVersionCallback.calls.count()).toBe(0);
    });

    describe('when --force is not specified', () => {
      it('prompts to unpublish ALL versions', async () => {
        const callback = jasmine.createSpy('callback');
        spyOn(Unpublish.prototype, 'prompt');
        await apmRun(['unpublish', 'test-package'], callback);
        waitsFor('waiting for prompt to be called', () => {
          return Unpublish.prototype.prompt.calls.argsFor(0)[0].match(/unpublish ALL VERSIONS of 'test-package'.*irreversible/);
        });
      });

      describe('when the user accepts the default answer', () => {
        it('does not unpublish the package', async () => {
          const callback = jasmine.createSpy('callback');
          spyOn(Unpublish.prototype, 'prompt').and.callFake(_question => Promise.resolve(''));
          spyOn(Unpublish.prototype, 'unpublishPackage');
          await apmRun(['unpublish', 'test-package'], callback);

          expect(Unpublish.prototype.unpublishPackage).not.toHaveBeenCalled();
          expect(callback.calls.argsFor(0)[0]).toMatch(/Cancelled/);
        });
      });
    });

    describe('when the package does not exist', () => {
      it('calls back with an error', async () => {
        const callback = jasmine.createSpy('callback');
        await apmRun(['unpublish', '--force', 'not-a-package'], callback);

        expect(callback.calls.argsFor(0)[0]).not.toBeUndefined();
        expect(unpublishPackageCallback.calls.count()).toBe(0);
        expect(unpublishVersionCallback.calls.count()).toBe(0);
      });
    });
  });

  describe('when a version is specified', () => {
    it('unpublishes the version', async () => {
      const callback = jasmine.createSpy('callback');
      await apmRun(['unpublish', '--force', 'test-package@1.0.0'], callback);

      expect(callback.calls.argsFor(0)[0]).toBeUndefined();
      expect(unpublishPackageCallback.calls.count()).toBe(0);
      expect(unpublishVersionCallback.calls.count()).toBe(1);
    });

    describe('when --force is not specified', () => {
      it('prompts to unpublish that version', async () => {
        spyOn(Unpublish.prototype, 'prompt');
        await apmRun(['unpublish', 'test-package@1.0.0']);
        waitsFor('waiting for prompt to be called', () => {
          return Unpublish.prototype.prompt.calls.argsFor(0)[0].match(/unpublish 'test-package@1.0.0'/);
        });
      });

      describe('when the user accepts the default answer', () => {
        it('does not unpublish the package', async () => {
          const callback = jasmine.createSpy('callback');
          spyOn(Unpublish.prototype, 'prompt').and.callFake(_question => Promise.resolve(''));
          spyOn(Unpublish.prototype, 'unpublishPackage');
          await apmRun(['unpublish', 'test-package'], callback);

          expect(Unpublish.prototype.unpublishPackage).not.toHaveBeenCalled();
          expect(callback.calls.argsFor(0)[0]).toMatch(/Cancelled/);
        });
      });
    });

    describe('when the version does not exist', () => {
      it('calls back with an error', async () => {
        const callback = jasmine.createSpy('callback');
        await apmRun(['unpublish', '--force', 'test-package@2.0.0'], callback);

        expect(callback.calls.argsFor(0)[0]).not.toBeUndefined();
        expect(unpublishPackageCallback.calls.count()).toBe(0);
        expect(unpublishVersionCallback.calls.count()).toBe(0);
      });
    });
  });
});
