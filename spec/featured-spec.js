const path = require('path')
const express = require('express')
const http = require('http')
const apm = require('../lib/apm-cli')

describe('apm featured', () => {
  var server = null

  beforeEach(() => {
    silenceOutput()
    spyOnToken()
    const app = express()
    app.get('/packages/featured', (request, response) => {
      response.sendFile(path.join(__dirname, 'fixtures', 'packages.json'))
    })
    app.get('/themes/featured', (request, response) => {
      response.sendFile(path.join(__dirname, 'fixtures', 'themes.json'))
    })
    server = http.createServer(app)
    var live = false
    server.listen(3000, '127.0.0.1', () => {
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

  it('lists the featured packages and themes', () => {
    const callback = jasmine.createSpy('callback')
    apm.run(['featured'], callback)
    waitsFor('waiting for command to complete', () => callback.callCount > 0)
    runs(() => {
      expect(console.log).toHaveBeenCalled()
      expect(console.log.argsForCall[1][0]).toContain('beverly-hills')
      expect(console.log.argsForCall[2][0]).toContain('multi-version')
      expect(console.log.argsForCall[3][0]).toContain('duckblur')
    })
  })

  describe('when the theme flag is specified', () => {
    it('lists the featured themes', () => {
      const callback = jasmine.createSpy('callback')
      apm.run(['featured', '--themes'], callback)
      waitsFor('waiting for command to complete', () => callback.callCount > 0)
      runs(() => {
        expect(console.log).toHaveBeenCalled()
        expect(console.log.argsForCall[1][0]).toContain('duckblur')
        expect(console.log.argsForCall[2][0]).toBeUndefined()
      })
    })
  })
})
