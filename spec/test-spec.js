const child_process = require('child_process')
const path = require('path')
const temp = require('temp')
const apm = require('../lib/apm-cli')

describe('apm test', () => {
  var specPath

  beforeEach(() => {
    silenceOutput()
    spyOnToken()
    const currentDir = temp.mkdirSync('apm-init-')
    spyOn(process, 'cwd').andReturn(currentDir)
    specPath = path.join(currentDir, 'spec')
  })

  it('calls atom to test', () => {
    const atomSpawn = spyOn(child_process, 'spawn').andReturn({
      stdout: {
        on: () => {}
      },
      stderr: {
        on: () => {}
      },
      on: () => {}
    })
    apm.run(['test'])
    waitsFor('waiting for test to complete', () => atomSpawn.callCount === 1)
    runs(() => {
      expect(atomSpawn.mostRecentCall.args[0].indexOf('atom')).not.toBe(-1)
      expect(atomSpawn.mostRecentCall.args[1][0]).toEqual('--dev')
      expect(atomSpawn.mostRecentCall.args[1][1]).toEqual('--test')
      expect(atomSpawn.mostRecentCall.args[1][2]).toEqual(specPath)
      if (process.platform !== 'win32') {
        expect(atomSpawn.mostRecentCall.args[2].streaming).toBeTruthy()
      }
    })
  })

  describe('returning', () => {
    var callback

    const returnWithCode = (type, code) => {
      callback = jasmine.createSpy('callback')
      const pulsarReturnFn = (e, fn) => e === type && fn(code)
      spyOn(child_process, 'spawn').andReturn({
        stdout: {
          on: () => {}
        },
        stderr: {
          on: () => {}
        },
        on: pulsarReturnFn,
        removeListener: () => {}
      })
      apm.run(['test'], callback)
    }

    describe('successfully', () => {
      beforeEach(() => returnWithCode('close', 0))
      it('prints success', () => {
        expect(callback).toHaveBeenCalled()
        expect(callback.mostRecentCall.args[0]).toBeUndefined()
        expect(process.stdout.write.mostRecentCall.args[0]).toEqual('Tests passed\n'.green)
      })
    })

    describe('with a failure', () => {
      beforeEach(() => returnWithCode('close', 1))
      it('prints failure', () => {
        expect(callback).toHaveBeenCalled()
        expect(callback.mostRecentCall.args[0]).toEqual('Tests failed')
      })
    })

    describe('with an error', () => {
      beforeEach(() => returnWithCode('error'))
      it('prints failure', () => {
        expect(callback).toHaveBeenCalled()
        expect(callback.mostRecentCall.args[0]).toEqual('Tests failed')
      })
    })
  })
})
