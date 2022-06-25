/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import yargs from "yargs"
import * as apm from "./apm"
import Command from "./command"
import type { CliOptions, RunCallback } from "./apm-cli"
import fs from "fs-plus"
import path from "path"

export default class Config extends Command {
  parseOptions(argv: string[]) {
    const options = yargs(argv).wrap(Math.min(100, yargs.terminalWidth()))
    options.usage(`\

Usage: apm config set <key> <value>
       apm config get <key>
       apm config delete <key>
       apm config list
       apm config edit
\
`)
    return options.alias("h", "help").describe("help", "Print this usage message")
  }

  run(options: CliOptions, callback: RunCallback) {
    options = this.parseOptions(options.commandArgs)

    const userconfig = apm.getUserConfigPath()
    const globalconfig = apm.getGlobalConfigPath()

    set_npm_config_cache(userconfig, globalconfig)

    let configArgs = ["--globalconfig", globalconfig, "--userconfig", userconfig, "config"]
    configArgs = configArgs.concat(options.argv._)

    const env = { ...process.env, HOME: this.atomNodeDirectory, RUSTUP_HOME: apm.getRustupHomeDirPath() }
    const configOptions = { env }

    return this.fork(this.atomNpmPath, configArgs, configOptions, function (code, stderr = "", stdout = "") {
      if (code === 0) {
        if (stdout) {
          process.stdout.write(stdout)
        }
        return callback()
      } else {
        if (stderr) {
          process.stdout.write(stderr)
        }
        return callback(new Error(`npm config failed: ${code}`))
      }
    })
  }
}

/// set the npm cache to the apm paths if they exist
export function set_npm_config_cache(userconfig: string, globalconfig: string) {
  if (fs.existsSync(userconfig)) {
    process.env.npm_config_cache = path.dirname(userconfig)
  } else if (fs.existsSync(globalconfig)) {
    process.env.npm_config_cache = path.dirname(globalconfig)
  }
}
