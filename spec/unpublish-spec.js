const express = require('express');
const http = require('http');
const temp = require('temp');
const apm = require('../src/apm-cli');
const Unpublish = require('../src/unpublish');

describe('apm unpublish', () => {
  let server, unpublishPackageCallback, unpublishVersionCallback;

  beforeEach(() => {
    silenceOutput();
    spyOnToken();

    unpublishPackageCallback = jasmine.createSpy('unpublishPackageCallback');
    unpublishVersionCallback = jasmine.createSpy('unpublishVersionCallback');

    const app = express();

    app.delete('/packages/test-package', (request, response) => {
      unpublishPackageCallback();
      response.status(204).send(204);
    });
    app.delete('/packages/test-package/versions/1.0.0', (request, response) => {
      unpublishVersionCallback();
      response.status(204).send(204);
    });

    server = http.createServer(app);

    let live = false;
    server.listen(3000, '127.0.0.1', () => {
      process.env.ATOM_HOME = temp.mkdirSync('apm-home-dir-');
      process.env.ATOM_API_URL = 'http://localhost:3000';
      live = true;
    });
    waitsFor(() => live);
  });

  afterEach(() => {
    let done = false;
    server.close(() => {
      done = true;
    });
    waitsFor(() => done);
  });

  describe('when no version is specified', () => {
    it('unpublishes the package', () => {
      const callback = jasmine.createSpy('callback');
      apm.run(['unpublish', '--force', 'test-package'], callback);

      waitsFor('waiting for unpublish command to complete', () => callback.callCount > 0);
      runs(() => {
        expect(callback.argsForCall[0][0]).toBeUndefined();
        expect(unpublishPackageCallback.callCount).toBe(1);
        expect(unpublishVersionCallback.callCount).toBe(0);
      });
    });

    describe('when --force is not specified', () => {
      it('prompts to unpublish ALL versions', () => {
        const callback = jasmine.createSpy('callback');
        spyOn(Unpublish.prototype, 'prompt');
        apm.run(['unpublish', 'test-package'], callback);
        waitsFor('waiting for prompt to be called', () => {
          return Unpublish.prototype.prompt.argsForCall[0][0].match(/unpublish ALL VERSIONS of 'test-package'.*irreversible/);
        });
      });

      describe('when the user accepts the default answer', () => {
        it('does not unpublish the package', () => {
          const callback = jasmine.createSpy('callback');
          spyOn(Unpublish.prototype, 'prompt').andCallFake(_question => Promise.resolve(''));
          spyOn(Unpublish.prototype, 'unpublishPackage');
          apm.run(['unpublish', 'test-package'], callback);

          waitsFor('waiting for unpublish command to complete', () => callback.callCount > 0);

          runs(() => {
            expect(Unpublish.prototype.unpublishPackage).not.toHaveBeenCalled();
            expect(callback.argsForCall[0][0]).toMatch(/Cancelled/);
          });
        });
      });
    });

    describe('when the package does not exist', () => {
      it('calls back with an error', () => {
        const callback = jasmine.createSpy('callback');
        apm.run(['unpublish', '--force', 'not-a-package'], callback);

        waitsFor('waiting for unpublish command to complete', () => callback.callCount > 0);

        runs(() => {
          expect(callback.argsForCall[0][0]).not.toBeUndefined();
          expect(unpublishPackageCallback.callCount).toBe(0);
          expect(unpublishVersionCallback.callCount).toBe(0);
        });
      });
    });
  });

  describe('when a version is specified', () => {
    it('unpublishes the version', () => {
      const callback = jasmine.createSpy('callback');
      apm.run(['unpublish', '--force', 'test-package@1.0.0'], callback);

      waitsFor('waiting for unpublish command to complete', () => callback.callCount > 0);
      runs(() => {
        expect(callback.argsForCall[0][0]).toBeUndefined();
        expect(unpublishPackageCallback.callCount).toBe(0);
        expect(unpublishVersionCallback.callCount).toBe(1);
      });
    });

    describe('when --force is not specified', () => {
      it('prompts to unpublish that version', () => {
        const callback = jasmine.createSpy('callback');
        spyOn(Unpublish.prototype, 'prompt');
        apm.run(['unpublish', 'test-package@1.0.0'], callback);
        waitsFor('waiting for prompt to be called', () => {
          return Unpublish.prototype.prompt.argsForCall[0][0].match(/unpublish 'test-package@1.0.0'/);
        });
      });

      describe('when the user accepts the default answer', () => {
        it('does not unpublish the package', () => {
          const callback = jasmine.createSpy('callback');
          spyOn(Unpublish.prototype, 'prompt').andCallFake(_question => Promise.resolve(''));
          spyOn(Unpublish.prototype, 'unpublishPackage');
          apm.run(['unpublish', 'test-package'], callback);

          waitsFor('waiting for unpublish command to complete', () => callback.callCount > 0);
          runs(() => {
            expect(Unpublish.prototype.unpublishPackage).not.toHaveBeenCalled();
            expect(callback.argsForCall[0][0]).toMatch(/Cancelled/);
          });
        });
      });
    });

    describe('when the version does not exist', () => {
      it('calls back with an error', () => {
        const callback = jasmine.createSpy('callback');
        apm.run(['unpublish', '--force', 'test-package@2.0.0'], callback);

        waitsFor('waiting for unpublish command to complete', () => callback.callCount > 0);
        runs(() => {
          expect(callback.argsForCall[0][0]).not.toBeUndefined();
          expect(unpublishPackageCallback.callCount).toBe(0);
          expect(unpublishVersionCallback.callCount).toBe(0);
        });
      });
    });
  });
});
