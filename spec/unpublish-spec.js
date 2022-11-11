
const slice = [].slice
const express = require('express')
const http = require('http')
const temp = require('temp')
const apm = require('../lib/apm-cli')
const Unpublish = require('../lib/unpublish')

describe('apm unpublish', () => {
  var server, unpublishPackageCallback, unpublishVersionCallback

  beforeEach(() => {
    silenceOutput()
    spyOnToken()
    unpublishPackageCallback = jasmine.createSpy('unpublishPackageCallback')
    unpublishVersionCallback = jasmine.createSpy('unpublishVersionCallback')
    const app = express()
    app['delete']('/packages/test-package', (request, response) => {
      unpublishPackageCallback()
      response.status(204).send(204)
    })
    app['delete']('/packages/test-package/versions/1.0.0', (request, response) => {
      unpublishVersionCallback()
      response.status(204).send(204)
    })
    server = http.createServer(app)
    var live = false
    server.listen(3000, '127.0.0.1', () => {
      process.env.ATOM_HOME = temp.mkdirSync('apm-home-dir-')
      process.env.ATOM_API_URL = 'http://localhost:3000'
      live = true
    })
    waitsFor(() => live)
  })

  afterEach(() => {
    var done = false
    server.close(() => {
      done = true
    })
    waitsFor(() => done)
  })

  describe('when no version is specified', () => {
    it('unpublishes the package', () => {
      const callback = jasmine.createSpy('callback')
      apm.run(['unpublish', '--force', 'test-package'], callback)
      waitsFor('waiting for unpublish command to complete', () => callback.callCount > 0)
      runs(() => {
        expect(callback.argsForCall[0][0]).toBeUndefined()
        expect(unpublishPackageCallback.callCount).toBe(1)
        expect(unpublishVersionCallback.callCount).toBe(0)
      })
    })

    describe('when --force is not specified', () => {
      it('prompts to unpublish ALL versions', () => {
        const callback = jasmine.createSpy('callback')
        spyOn(Unpublish.prototype, 'prompt')
        apm.run(['unpublish', 'test-package'], callback)
        waitsFor('waiting for prompt to be called', () => {
          return Unpublish.prototype.prompt.argsForCall[0][0].match(/unpublish ALL VERSIONS of 'test-package'.*irreversible/)
        })
      })

      describe('when the user accepts the default answer', () => {
        it('does not unpublish the package', () => {
          const callback = jasmine.createSpy('callback')
          spyOn(Unpublish.prototype, 'prompt').andCallFake(function () {
            var i, args
            if (arguments.length >= 2) {
              i = arguments.length - 1
              args = slice.call(arguments, 0, i)
            } else {
              i = 0
              args = []
            }
            const cb = arguments[i++]
            cb('')
          })
          spyOn(Unpublish.prototype, 'unpublishPackage')
          apm.run(['unpublish', 'test-package'], callback)
          waitsFor('waiting for unpublish command to complete', () => callback.callCount > 0)
          runs(() => {
            expect(Unpublish.prototype.unpublishPackage).not.toHaveBeenCalled()
            expect(callback.argsForCall[0][0]).toMatch(/Cancelled/)
          })
        })
      })
    })

    describe('when the package does not exist', () => {
      it('calls back with an error', () => {
        const callback = jasmine.createSpy('callback')
        apm.run(['unpublish', '--force', 'not-a-package'], callback)
        waitsFor('waiting for unpublish command to complete', () => callback.callCount > 0)
        runs(() => {
          expect(callback.argsForCall[0][0]).not.toBeUndefined()
          expect(unpublishPackageCallback.callCount).toBe(0)
          expect(unpublishVersionCallback.callCount).toBe(0)
        })
      })
    })
  })

  describe('when a version is specified', () => {
    it('unpublishes the version', () => {
      const callback = jasmine.createSpy('callback')
      apm.run(['unpublish', '--force', 'test-package@1.0.0'], callback)
      waitsFor('waiting for unpublish command to complete', () => callback.callCount > 0)
      runs(() => {
        expect(callback.argsForCall[0][0]).toBeUndefined()
        expect(unpublishPackageCallback.callCount).toBe(0)
        expect(unpublishVersionCallback.callCount).toBe(1)
      })
    })

    describe('when --force is not specified', () => {
      it('prompts to unpublish that version', () => {
        var callback
        callback = jasmine.createSpy('callback')
        spyOn(Unpublish.prototype, 'prompt')
        apm.run(['unpublish', 'test-package@1.0.0'], callback)
        waitsFor('waiting for prompt to be called', () => {
          return Unpublish.prototype.prompt.argsForCall[0][0].match(/unpublish 'test-package@1.0.0'/)
        })
      })

      describe('when the user accepts the default answer', () => {
        it('does not unpublish the package', () => {
          var callback
          callback = jasmine.createSpy('callback')
          spyOn(Unpublish.prototype, 'prompt').andCallFake(function () {
            var i, args
            if (arguments.length >= 2) {
              i = arguments.length - 1
              args = slice.call(arguments, 0, i)
            } else {
              i = 0
              args = []
            }
            const cb = arguments[i++]
            cb('')
          })
          spyOn(Unpublish.prototype, 'unpublishPackage')
          apm.run(['unpublish', 'test-package'], callback)
          waitsFor('waiting for unpublish command to complete', () => callback.callCount > 0)
          runs(() => {
            expect(Unpublish.prototype.unpublishPackage).not.toHaveBeenCalled()
            expect(callback.argsForCall[0][0]).toMatch(/Cancelled/)
          })
        })
      })
    })

    describe('when the version does not exist', () => {
      it('calls back with an error', () => {
        const callback = jasmine.createSpy('callback')
        apm.run(['unpublish', '--force', 'test-package@2.0.0'], callback)
        waitsFor('waiting for unpublish command to complete', () => callback.callCount > 0)
        runs(() => {
          expect(callback.argsForCall[0][0]).not.toBeUndefined()
          expect(unpublishPackageCallback.callCount).toBe(0)
          expect(unpublishVersionCallback.callCount).toBe(0)
        })
      })
    })
  })
})
