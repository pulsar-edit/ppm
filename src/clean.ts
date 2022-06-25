/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import yargs from "yargs"
import Command, { LogCommandResultsArgs } from "./command"
import type { CliOptions, RunCallback } from "./apm-cli"

export default class Clean extends Command {
  parseOptions(argv: string[]) {
    const options = yargs(argv).wrap(Math.min(100, yargs.terminalWidth()))

    options.usage(`\
Usage: apm clean

Deletes all packages in the node_modules folder that are not referenced
as a dependency in the package.json file.\
`)
    return options.alias("h", "help").describe("help", "Print this usage message")
  }

  run(options: CliOptions, callback: RunCallback) {
    process.stdout.write("Removing extraneous modules ")
    return this.fork(this.atomNpmPath, ["prune"], (...args: LogCommandResultsArgs) => {
      return this.logCommandResults(callback, ...args)
    })
  }
}
