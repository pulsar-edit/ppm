/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS104: Avoid inline assignments
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import path from "path"
import CSON from "season"
import yargs from "yargs"
import Command from "./command"
import fs from "./fs"
import type { CliOptions, RunCallback } from "./apm-cli"
import { PathLike } from "fs-plus"

export default class Unlink extends Command {
  parseOptions(argv: string[]) {
    const options = yargs(argv).wrap(Math.min(100, yargs.terminalWidth()))
    options.usage(`\

Usage: apm unlink [<package_path>]

Delete the symlink in ~/.atom/packages for the package. The package in the
current working directory is unlinked if no path is given.

Run \`apm links\` to view all the currently linked packages.\
`)
    options.alias("h", "help").describe("help", "Print this usage message")
    options.alias("d", "dev").boolean("dev").describe("dev", "Unlink package from ~/.atom/dev/packages")
    options.boolean("hard").describe("hard", "Unlink package from ~/.atom/packages and ~/.atom/dev/packages")
    return options
      .alias("a", "all")
      .boolean("all")
      .describe("all", "Unlink all packages in ~/.atom/packages and ~/.atom/dev/packages")
  }

  getDevPackagePath(packageName: string) {
    return path.join(this.atomDevPackagesDirectory, packageName)
  }

  getPackagePath(packageName: string) {
    return path.join(this.atomPackagesDirectory, packageName)
  }

  unlinkPath(pathToUnlink: PathLike) {
    try {
      process.stdout.write(`Unlinking ${pathToUnlink} `)
      fs.unlinkSync(pathToUnlink)
      return this.logSuccess()
    } catch (error) {
      this.logFailure()
      throw error
    }
  }

  unlinkAll(options: CliOptions, callback: (error?: string | Error) => any) {
    try {
      let child: string, packagePath: string
      for (child of fs.list(this.atomDevPackagesDirectory)) {
        packagePath = path.join(this.atomDevPackagesDirectory, child)
        if (fs.isSymbolicLinkSync(packagePath)) {
          this.unlinkPath(packagePath)
        }
      }
      if (!options.argv.dev) {
        for (child of fs.list(this.atomPackagesDirectory)) {
          packagePath = path.join(this.atomPackagesDirectory, child)
          if (fs.isSymbolicLinkSync(packagePath)) {
            this.unlinkPath(packagePath)
          }
        }
      }
      return callback()
    } catch (error) {
      return callback(error as Error)
    }
  }

  unlinkPackage(options: CliOptions, callback: (error?: string | Error) => any) {
    let error: Error, left: any, packageName: string
    const packagePath = (left = options.argv._[0]?.toString()) != null ? left : "."
    const linkPath = path.resolve(process.cwd(), packagePath)

    try {
      packageName = CSON.readFileSync(CSON.resolve(path.join(linkPath, "package"))).name
    } catch (error3) {
      /* ignore error */
    }
    if (!packageName) {
      packageName = path.basename(linkPath)
    }

    if (options.argv.hard) {
      try {
        this.unlinkPath(this.getDevPackagePath(packageName))
        this.unlinkPath(this.getPackagePath(packageName))
        return callback()
      } catch (error1) {
        error = error1 as Error
        return callback(error as Error)
      }
    } else {
      let targetPath: string
      if (options.argv.dev) {
        targetPath = this.getDevPackagePath(packageName)
      } else {
        targetPath = this.getPackagePath(packageName)
      }
      try {
        this.unlinkPath(targetPath)
        return callback()
      } catch (error2) {
        error = error2 as Error
        return callback(error)
      }
    }
  }

  run(options: CliOptions, callback: RunCallback) {
    options = this.parseOptions(options.commandArgs)

    if (options.argv.all) {
      return this.unlinkAll(options, callback)
    } else {
      return this.unlinkPackage(options, callback)
    }
  }
}
