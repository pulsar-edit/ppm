/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import * as Packages from "../lib/packages"

describe("getRemote", function () {
  it("returns origin if remote could not be determined", () => expect(Packages.getRemote()).toEqual("origin"))

  it("returns repository.url", function () {
    const pack = {
      repository: {
        type: "git",
        url: "https://github.com/atom/apm.git",
      },
    }
    expect(Packages.getRemote(pack)).toEqual(pack.repository.url)
  })

  it("returns repository", function () {
    const pack = { repository: "https://github.com/atom/apm" }
    expect(Packages.getRemote(pack)).toEqual(pack.repository)
  })
})
