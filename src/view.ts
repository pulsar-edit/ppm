/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS104: Avoid inline assignments
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import * as _ from "@aminya/underscore-plus"
import yargs from "yargs"
import semver from "semver"
import Command from "./command"
import * as config from "./apm"
import * as request from "./request"
import { tree } from "./tree"

export default class View extends Command {
  parseOptions(argv) {
    const options = yargs(argv).wrap(Math.min(100, yargs.terminalWidth()))
    options.usage(`\

Usage: apm view <package_name>

View information about a package/theme in the atom.io registry.\
`)
    options.alias("h", "help").describe("help", "Print this usage message")
    options.boolean("json").describe("json", "Output featured packages as JSON array")
    return options
      .string("compatible")
      .describe("compatible", "Show the latest version compatible with this Atom version")
  }

  loadInstalledAtomVersion(options, callback) {
    return process.nextTick(() => {
      let installedAtomVersion
      if (options.argv.compatible) {
        const version = this.normalizeVersion(options.argv.compatible)
        if (semver.valid(version)) {
          installedAtomVersion = version
        }
      }
      return callback(installedAtomVersion)
    })
  }

  getLatestCompatibleVersion(pack, options, callback) {
    return this.loadInstalledAtomVersion(options, function (installedAtomVersion) {
      if (!installedAtomVersion) {
        return callback(pack.releases.latest)
      }

      let latestVersion = null
      const object = pack.versions != null ? pack.versions : {}
      for (const version in object) {
        const metadata = object[version]
        if (!semver.valid(version)) {
          continue
        }
        if (!metadata) {
          continue
        }

        const engine = metadata.engines?.atom != null ? metadata.engines?.atom : "*"
        if (!semver.validRange(engine)) {
          continue
        }
        if (!semver.satisfies(installedAtomVersion, engine)) {
          continue
        }

        if (latestVersion == null) {
          latestVersion = version
        }
        if (semver.gt(version, latestVersion)) {
          latestVersion = version
        }
      }

      return callback(latestVersion)
    })
  }

  getRepository(pack) {
    let repository
    if ((repository = pack.repository?.url != null ? pack.repository?.url : pack.repository)) {
      return repository.replace(/\.git$/, "")
    }
  }

  getPackage(packageName, options, callback) {
    const requestSettings = {
      url: `${config.getAtomPackagesUrl()}/${packageName}`,
      json: true,
    }
    return request.get(requestSettings, (error, response, body = {}) => {
      if (error != null) {
        return callback(error)
      } else if (response.statusCode === 200) {
        return this.getLatestCompatibleVersion(body, options, function (version) {
          const { name, readme, downloads, stargazers_count } = body
          const metadata = body.versions?.[version] != null ? body.versions?.[version] : { name }
          const pack = { ...metadata, readme, downloads, stargazers_count }
          return callback(null, pack)
        })
      } else {
        let left
        const message = (left = body.message != null ? body.message : body.error) != null ? left : body
        return callback(`Requesting package failed: ${message}`)
      }
    })
  }

  run(options, callback) {
    options = this.parseOptions(options.commandArgs)
    const [packageName] = Array.from(options.argv._)

    if (!packageName) {
      callback("Missing required package name")
      return
    }

    return this.getPackage(packageName, options, (error, pack) => {
      if (error != null) {
        callback(error)
        return
      }

      if (options.argv.json) {
        console.log(JSON.stringify(pack, null, 2))
      } else {
        let repository
        console.log(`${pack.name.cyan}`)
        const items = []
        if (pack.version) {
          items.push(pack.version.yellow)
        }
        if ((repository = this.getRepository(pack))) {
          items.push(repository.underline)
        }
        if (pack.description) {
          items.push(pack.description.replace(/\s+/g, " "))
        }
        if (pack.downloads >= 0) {
          items.push(_.pluralize(pack.downloads, "download"))
        }
        if (pack.stargazers_count >= 0) {
          items.push(_.pluralize(pack.stargazers_count, "star"))
        }

        tree(items)

        console.log()
        console.log(`Run \`apm install ${pack.name}\` to install this package.`)
        console.log()
      }

      return callback()
    })
  }
}
