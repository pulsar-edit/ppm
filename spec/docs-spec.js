/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const path = require("path")
const express = require("express")
const http = require("http")
const apm = require("../lib/apm-cli")
import Docs from "../lib/docs"

describe("apm docs", function () {
  let server = null

  beforeEach(function () {
    spyOnConsole()
    spyOnToken()

    const app = express()
    app.get("/wrap-guide", (request, response) =>
      response.sendFile(path.join(__dirname, "fixtures", "wrap-guide.json"))
    )
    app.get("/install", (request, response) => response.sendFile(path.join(__dirname, "fixtures", "install.json")))
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

  it("logs an error if the package has no URL", function () {
    const callback = jasmine.createSpy("callback")
    apm.run(["docs", "install"], callback)

    waitsFor("waiting for command to complete", () => callback.callCount > 0)
    runs(function () {
      expect(console.error).toHaveBeenCalled()
      expect(console.error.argsForCall[0][0].length).toBeGreaterThan(0)
    })
  })

  it("logs an error if the package name is missing or empty", function () {
    const callback = jasmine.createSpy("callback")
    apm.run(["docs"], callback)

    waitsFor("waiting for command to complete", () => callback.callCount > 0)

    runs(function () {
      expect(console.error).toHaveBeenCalled()
      expect(console.error.argsForCall[0][0].length).toBeGreaterThan(0)
    })
  })

  it("prints the package URL if called with the --print option (and does not open it)", function () {
    spyOn(Docs.prototype, "openRepositoryUrl")
    const callback = jasmine.createSpy("callback")
    apm.run(["docs", "--print", "wrap-guide"], callback)

    waitsFor("waiting for command to complete", () => callback.callCount > 0)

    runs(function () {
      expect(Docs.prototype.openRepositoryUrl).not.toHaveBeenCalled()
      expect(console.log).toHaveBeenCalled()
      expect(console.log.argsForCall[0][0]).toContain("https://github.com/atom/wrap-guide")
    })
  })

  it("prints the package URL if called with the -p short option (and does not open it)", function () {
    spyOn(Docs.prototype, "openRepositoryUrl")
    const callback = jasmine.createSpy("callback")
    apm.run(["docs", "-p", "wrap-guide"], callback)

    waitsFor("waiting for command to complete", () => callback.callCount > 0)

    runs(function () {
      expect(Docs.prototype.openRepositoryUrl).not.toHaveBeenCalled()
      expect(console.log).toHaveBeenCalled()
      expect(console.log.argsForCall[0][0]).toContain("https://github.com/atom/wrap-guide")
    })
  })

  it("opens the package URL", function () {
    spyOn(Docs.prototype, "openRepositoryUrl")
    const callback = jasmine.createSpy("callback")
    apm.run(["docs", "wrap-guide"], callback)

    waitsFor("waiting for command to complete", () => callback.callCount > 0)

    runs(() => expect(Docs.prototype.openRepositoryUrl).toHaveBeenCalled())
  })
})
