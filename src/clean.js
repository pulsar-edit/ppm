/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import path from "path"
import async from "async"
import CSON from "season"
import yargs from "yargs"
import _ from "underscore-plus"
import Command from "./command"
import config from "./apm"
import fs from "./fs"

export default class Clean extends Command {
  constructor() {
    super()
    this.atomNpmPath = require.resolve("npm/bin/npm-cli")
  }

  parseOptions(argv) {
    const options = yargs(argv).wrap(Math.min(100, yargs.terminalWidth()))

    options.usage(`\
Usage: apm clean

Deletes all packages in the node_modules folder that are not referenced
as a dependency in the package.json file.\
`)
    return options.alias("h", "help").describe("help", "Print this usage message")
  }

  run(options) {
    process.stdout.write("Removing extraneous modules ")
    return this.fork(this.atomNpmPath, ["prune"], (...args) => {
      return this.logCommandResults(options.callback, ...Array.from(args))
    })
  }
}
