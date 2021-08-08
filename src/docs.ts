/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import yargs from "yargs"
import open from "open"
import View from "./view"

export default class Docs extends View {
  parseOptions(argv) {
    const options = yargs(argv).wrap(Math.min(100, yargs.terminalWidth()))
    options.usage(`\

Usage: apm docs [options] <package_name>

Open a package's homepage in the default browser.\
`)
    options.alias("h", "help").describe("help", "Print this usage message")
    return options.boolean("p").alias("p", "print").describe("print", "Print the URL instead of opening it")
  }

  openRepositoryUrl(repositoryUrl) {
    return open(repositoryUrl)
  }

  run(options, callback) {
    options = this.parseOptions(options.commandArgs)
    const [packageName] = Array.from(options.argv._)

    if (!packageName) {
      callback("Missing required package name")
      return
    }

    return this.getPackage(packageName, options, (error, pack) => {
      let repository
      if (error != null) {
        return callback(error)
      }

      if ((repository = this.getRepository(pack))) {
        if (options.argv.print) {
          console.log(repository)
        } else {
          this.openRepositoryUrl(repository)
        }
        return callback()
      } else {
        return callback(`Package \"${packageName}\" does not contain a repository URL`)
      }
    })
  }
}
