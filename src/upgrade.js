/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS104: Avoid inline assignments
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import path from "path"
import async from "async"
import yargs from "yargs"
import read from "read"
import semver from "semver"
import Git from "git-utils"
import Command from "./command"
import * as config from "./apm"
import fs from "./fs"
import Install from "./install"
import * as Packages from "./packages"
import * as request from "./request"
import { tree } from "./tree"
import * as git from "./git"

export default class Upgrade extends Command {
  constructor() {
    super()
    this.atomDirectory = config.getAtomDirectory()
    this.atomPackagesDirectory = path.join(this.atomDirectory, "packages")
  }

  parseOptions(argv) {
    const options = yargs(argv).wrap(Math.min(100, yargs.terminalWidth()))
    options.usage(`\

Usage: apm upgrade
       apm upgrade --list
       apm upgrade [<package_name>...]

Upgrade out of date packages installed to ~/.atom/packages

This command lists the out of date packages and then prompts to install
available updates.\
`)
    options
      .alias("c", "confirm")
      .boolean("confirm")
      .default("confirm", true)
      .describe("confirm", "Confirm before installing updates")
    options.alias("h", "help").describe("help", "Print this usage message")
    options.alias("l", "list").boolean("list").describe("list", "List but don't install the outdated packages")
    options.boolean("json").describe("json", "Output outdated packages as a JSON array")
    options.string("compatible").describe("compatible", "Only list packages/themes compatible with this Atom version")
    return options.boolean("verbose").default("verbose", false).describe("verbose", "Show verbose debug information")
  }

  getInstalledPackages(options) {
    let packages = []
    for (const name of fs.list(this.atomPackagesDirectory)) {
      let pack
      if ((pack = this.getIntalledPackage(name))) {
        packages.push(pack)
      }
    }

    const packageNames = this.packageNamesFromArgv(options.argv)
    if (packageNames.length > 0) {
      packages = packages.filter(({ name }) => packageNames.indexOf(name) !== -1)
    }

    return packages
  }

  getIntalledPackage(name) {
    const packageDirectory = path.join(this.atomPackagesDirectory, name)
    if (fs.isSymbolicLinkSync(packageDirectory)) {
      return
    }
    try {
      const metadata = JSON.parse(fs.readFileSync(path.join(packageDirectory, "package.json")))
      if (metadata?.name && metadata?.version) {
        return metadata
      }
    } catch (error) {
      /* ignore error */
    }
  }

  loadInstalledAtomVersion(options, callback) {
    if (options.argv.compatible) {
      return process.nextTick(() => {
        const version = this.normalizeVersion(options.argv.compatible)
        if (semver.valid(version)) {
          this.installedAtomVersion = version
        }
        return callback()
      })
    } else {
      return this.loadInstalledAtomMetadata(callback)
    }
  }

  folderIsRepo(pack) {
    const repoGitFolderPath = path.join(this.atomPackagesDirectory, pack.name, ".git")
    return fs.existsSync(repoGitFolderPath)
  }

  getLatestVersion(pack, callback) {
    const requestSettings = {
      url: `${config.getAtomPackagesUrl()}/${pack.name}`,
      json: true,
    }
    return request.get(requestSettings, (error, response, body = {}) => {
      if (error != null) {
        return callback(`Request for package information failed: ${error.message}`)
      } else if (response.statusCode === 404) {
        return callback()
      } else if (response.statusCode !== 200) {
        let left
        const message = (left = body.message != null ? body.message : body.error) != null ? left : body
        return callback(`Request for package information failed: ${message}`)
      } else {
        let version
        const atomVersion = this.installedAtomVersion
        let latestVersion = pack.version
        const object = body.versions != null ? body.versions : {}
        for (version in object) {
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
          if (!semver.satisfies(atomVersion, engine)) {
            continue
          }

          if (semver.gt(version, latestVersion)) {
            latestVersion = version
          }
        }

        if (latestVersion !== pack.version && this.hasRepo(pack)) {
          return callback(null, latestVersion)
        } else {
          return callback()
        }
      }
    })
  }

  getLatestSha(pack, callback) {
    const repoPath = path.join(this.atomPackagesDirectory, pack.name)
    return config.getSetting("git", (command) => {
      if (command == null) {
        command = "git"
      }
      const args = ["fetch", "origin", "master"]
      git.addGitToEnv(process.env)
      return this.spawn(command, args, { cwd: repoPath }, function (code, stderr = "") {
        if (code !== 0) {
          return callback(new Error(`Exit code: ${code} - ${stderr}`))
        }
        const repo = Git.open(repoPath)
        const sha = repo.getReferenceTarget(repo.getUpstreamBranch("refs/heads/master"))
        if (sha !== pack.apmInstallSource.sha) {
          return callback(null, sha)
        } else {
          return callback()
        }
      })
    })
  }

  hasRepo(pack) {
    return Packages.getRepository(pack) != null
  }

  getAvailableUpdates(packages, callback) {
    const getLatestVersionOrSha = (pack, done) => {
      if (this.folderIsRepo(pack) && pack.apmInstallSource?.type === "git") {
        return this.getLatestSha(pack, (err, sha) => done(err, { pack, sha }))
      } else {
        return this.getLatestVersion(pack, (err, latestVersion) => done(err, { pack, latestVersion }))
      }
    }

    return async.mapLimit(packages, 10, getLatestVersionOrSha, function (error, updates) {
      if (error != null) {
        return callback(error)
      }

      updates = updates.filter((update) => update.latestVersion != null || update.sha != null)
      updates.sort((updateA, updateB) => updateA.pack.name.localeCompare(updateB.pack.name))

      return callback(null, updates)
    })
  }

  promptForConfirmation(callback) {
    return read({ prompt: "Would you like to install these updates? (yes)", edit: true }, function (error, answer) {
      answer = answer ? answer.trim().toLowerCase() : "yes"
      return callback(error, answer === "y" || answer === "yes")
    })
  }

  installUpdates(updates, callback) {
    const installCommands = []
    const { verbose } = this
    for (const { pack, latestVersion } of updates) {
      ;((pack, latestVersion) =>
        installCommands.push(function (callback) {
          let commandArgs
          if (pack.apmInstallSource?.type === "git") {
            commandArgs = [pack.apmInstallSource.source]
          } else {
            commandArgs = [`${pack.name}@${latestVersion}`]
          }
          if (verbose) {
            commandArgs.unshift("--verbose")
          }
          return new Install().run({ commandArgs }, callback)
        }))(pack, latestVersion)
    }

    return async.waterfall(installCommands, callback)
  }

  run(options, callback) {
    const { command } = options
    options = this.parseOptions(options.commandArgs)
    options.command = command

    this.verbose = options.argv.verbose
    if (this.verbose) {
      request.debug(true)
      process.env.NODE_DEBUG = "request"
    }

    return this.loadInstalledAtomVersion(options, () => {
      if (this.installedAtomVersion) {
        return this.upgradePackages(options, callback)
      } else {
        return callback("Could not determine current Atom version installed")
      }
    })
  }

  upgradePackages(options, callback) {
    const packages = this.getInstalledPackages(options)
    return this.getAvailableUpdates(packages, (error, updates) => {
      if (error != null) {
        return callback(error)
      }

      if (options.argv.json) {
        const packagesWithLatestVersionOrSha = updates.map(function ({ pack, latestVersion, sha }) {
          if (latestVersion) {
            pack.latestVersion = latestVersion
          }
          if (sha) {
            pack.latestSha = sha
          }
          return pack
        })
        console.log(JSON.stringify(packagesWithLatestVersionOrSha))
      } else {
        console.log(`${"Package Updates Available".cyan} (${updates.length})`)
        tree(updates, function ({ pack, latestVersion, sha }) {
          const { apmInstallSource } = pack
          let { name, version } = pack
          name = name.yellow
          if (sha != null) {
            version = apmInstallSource.sha.substr(0, 8).red
            latestVersion = sha.substr(0, 8).green
          } else {
            version = version.red
            latestVersion = latestVersion.green
          }
          latestVersion = latestVersion?.green || apmInstallSource?.sha?.green
          return `${name} ${version} -> ${latestVersion}`
        })
      }

      if (options.command === "outdated") {
        return callback()
      }
      if (options.argv.list) {
        return callback()
      }
      if (updates.length === 0) {
        return callback()
      }

      console.log()
      if (options.argv.confirm) {
        return this.promptForConfirmation((error, confirmed) => {
          if (error != null) {
            return callback(error)
          }

          if (confirmed) {
            console.log()
            return this.installUpdates(updates, callback)
          } else {
            return callback()
          }
        })
      } else {
        return this.installUpdates(updates, callback)
      }
    })
  }
}
