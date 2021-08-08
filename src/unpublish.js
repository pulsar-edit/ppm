/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS104: Avoid inline assignments
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import path from "path"
import readline from "readline"
import yargs from "yargs"

import * as auth from "./auth"
import Command from "./command"
import * as config from "./apm"
import fs from "./fs"
import * as request from "./request"

export default class Unpublish extends Command {
  parseOptions(argv) {
    const options = yargs(argv).wrap(Math.min(100, yargs.terminalWidth()))

    options.usage(`\
Usage: apm unpublish [<package_name>]
       apm unpublish <package_name>@<package_version>

Remove a published package or package version from the atom.io registry.

The package in the current working directory will be used if no package
name is specified.\
`)
    options.alias("h", "help").describe("help", "Print this usage message")
    return options.alias("f", "force").boolean("force").describe("force", "Do not prompt for confirmation")
  }

  unpublishPackage(packageName, packageVersion, callback) {
    let packageLabel = packageName
    if (packageVersion) {
      packageLabel += `@${packageVersion}`
    }

    process.stdout.write(`Unpublishing ${packageLabel} `)

    return auth.getToken((error, token) => {
      if (error != null) {
        this.logFailure()
        callback(error)
        return
      }

      const options = {
        uri: `${config.getAtomPackagesUrl()}/${packageName}`,
        headers: {
          authorization: token,
        },
        json: true,
      }

      if (packageVersion) {
        options.uri += `/versions/${packageVersion}`
      }

      return request.del(options, (error, response, body = {}) => {
        if (error != null) {
          this.logFailure()
          return callback(error)
        } else if (response.statusCode !== 204) {
          let left
          this.logFailure()
          const message = (left = body.message != null ? body.message : body.error) != null ? left : body
          return callback(`Unpublishing failed: ${message}`)
        } else {
          this.logSuccess()
          return callback()
        }
      })
    })
  }

  promptForConfirmation(packageName, packageVersion, callback) {
    let question
    let packageLabel = packageName
    if (packageVersion) {
      packageLabel += `@${packageVersion}`
    }

    if (packageVersion) {
      question = `Are you sure you want to unpublish '${packageLabel}'? (no) `
    } else {
      question =
        `Are you sure you want to unpublish ALL VERSIONS of '${packageLabel}'? ` +
        "This will remove it from the apm registry, including " +
        "download counts and stars, and this action is irreversible. (no)"
    }

    return this.prompt(question, (answer) => {
      answer = answer ? answer.trim().toLowerCase() : "no"
      if (["y", "yes"].includes(answer)) {
        return this.unpublishPackage(packageName, packageVersion, callback)
      } else {
        return callback(`Cancelled unpublishing ${packageLabel}`)
      }
    })
  }

  prompt(question, callback) {
    const prompt = readline.createInterface(process.stdin, process.stdout)

    return prompt.question(question, function (answer) {
      prompt.close()
      return callback(answer)
    })
  }

  run(options, callback) {
    let version
    options = this.parseOptions(options.commandArgs)
    let [name] = Array.from(options.argv._)

    if (name?.length > 0) {
      const atIndex = name.indexOf("@")
      if (atIndex !== -1) {
        version = name.substring(atIndex + 1)
        name = name.substring(0, atIndex)
      }
    }

    if (!name) {
      try {
        name = JSON.parse(fs.readFileSync("package.json"))?.name
      } catch (error) {
        /* ignore error */
      }
    }

    if (!name) {
      name = path.basename(process.cwd())
    }

    if (options.argv.force) {
      return this.unpublishPackage(name, version, callback)
    } else {
      return this.promptForConfirmation(name, version, callback)
    }
  }
}
