/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const path = require("path")
const express = require("express")
const http = require("http")
import * as apm from "../lib/apm-cli"

describe("apm search", function () {
  let server = null

  beforeEach(function () {
    spyOnConsole()
    spyOnToken()

    const app = express()
    app.get("/search", (request, response) => response.sendFile(path.join(__dirname, "fixtures", "search.json")))
    server = http.createServer(app)

    let live = false
    server.listen(3000, "127.0.0.1", function () {
      process.env.ATOM_PACKAGES_URL = "http://localhost:3000"
      return (live = true)
    })
    waitsFor(() => live)
  })

  afterEach(function () {
    let done = false
    server.close(() => (done = true))
    waitsFor(() => done)
  })

  it("lists the matching packages and excludes deprecated packages", function () {
    const callback = jasmine.createSpy("callback")
    apm.run(["search", "duck"], callback)

    waitsFor("waiting for command to complete", () => callback.callCount > 0)

    runs(function () {
      expect(console.log).toHaveBeenCalled()
      expect(console.log.argsForCall[1][0]).toContain("duckberg")
      expect(console.log.argsForCall[2][0]).toContain("ducktales")
      expect(console.log.argsForCall[3][0]).toContain("duckblur")
      expect(console.log.argsForCall[4][0]).toBeUndefined()
    })
  })

  it("logs an error if the query is missing or empty", function () {
    const callback = jasmine.createSpy("callback")
    apm.run(["search"], callback)

    waitsFor("waiting for command to complete", () => callback.callCount > 0)

    runs(function () {
      expect(console.error).toHaveBeenCalled()
      expect(console.error.argsForCall[0][0].length).toBeGreaterThan(0)
    })
  })
})
