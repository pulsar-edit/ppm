/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const path = require("path")
const fs = require("fs-plus")
const temp = require("temp")
import * as apm from "../lib/apm-cli"

describe("apm config", function () {
  let userConfigPath

  beforeEach(function () {
    spyOnToken()
    spyOnConsole()

    const atomHome = temp.mkdirSync("apm-home-dir-")
    process.env.ATOM_HOME = atomHome
    userConfigPath = path.join(atomHome, ".apmrc")

    // Make sure the cache used is the one for the test env
    delete process.env.npm_config_cache
  })

  describe("apm config get", () =>
    it("reads the value from the global config when there is no user config", function () {
      expect(fs.isFileSync(userConfigPath)).toBe(false)
      expect(process.env.npm_config_cache).toBe(undefined)

      const callback = jasmine.createSpy("callback")
      apm.run(["config", "get", "cache"], callback)

      waitsFor("waiting for config get to complete", 6000000, () => callback.callCount === 1)

      runs(() => expect(process.stdout.write.argsForCall[0][0].trim()).toBe(path.join(process.env.ATOM_HOME, ".apm")))
    }))

  describe("apm config set", () =>
    it("sets the value in the user config", function () {
      expect(fs.isFileSync(userConfigPath)).toBe(false)

      const callback = jasmine.createSpy("callback")
      apm.run(["config", "set", "foo", "bar"], callback)

      waitsFor("waiting for config set to complete", 600000, () => callback.callCount === 1)

      runs(function () {
        expect(fs.isFileSync(userConfigPath)).toBe(true)

        callback.reset()
        apm.run(["config", "get", "foo"], callback)
      })

      waitsFor("waiting for config get to complete", 600000, () => callback.callCount === 1)

      runs(() => expect(process.stdout.write.argsForCall[0][0].trim()).toBe("bar"))
    }))
})
