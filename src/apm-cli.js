/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS104: Avoid inline assignments
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import { spawn } from "child_process"
import path from "path"
import colors from "colors"
import npm from "npm"
import yargs from "yargs"
import wordwrap from "wordwrap"

// Enable "require" scripts in asar archives
import "asar-require"

import * as config from "./apm"
import fs from "./fs"
import * as git from "./git"

function setupTempDirectory() {
  const temp = require("temp")
  let tempDirectory = require("os").tmpdir()
  // Resolve ~ in tmp dir atom/atom#2271
  tempDirectory = path.resolve(fs.absolute(tempDirectory))
  temp.dir = tempDirectory
  try {
    fs.makeTreeSync(temp.dir)
  } catch (error) {
    /* ignore error */
  }
  return temp.track()
}

setupTempDirectory()

const ciClass = () => require("./ci")
const cleanClass = () => require("./clean")
const configClass = () => require("./config")
const dedupClass = () => require("./dedupe")
const developClass = () => require("./develop")
const disableClass = () => require("./disable")
const docsClass = () => require("./docs")
const enableClass = () => require("./enable")
const featuredClass = () => require("./featured")
const initClass = () => require("./init")
const installClass = () => require("./install")
const linksClass = () => require("./links")
const linkClass = () => require("./link")
const listClass = () => require("./list")
const loginClass = () => require("./login")
const publishClass = () => require("./publish")
const rebuildClass = () => require("./rebuild")
const rebuildModuleCacheClass = () => require("./rebuild-module-cache")
const searchClass = () => require("./search")
const starClass = () => require("./star")
const starsClass = () => require("./stars")
const testClass = () => require("./test")
const uninstallClass = () => require("./uninstall")
const unlinkClass = () => require("./unlink")
const unpublishClass = () => require("./unpublish")
const unstarClass = () => require("./unstar")
const upgradeClass = () => require("./upgrade")
const viewClass = () => require("./view")

const commands = {
  ci: ciClass,
  clean: cleanClass,
  prune: cleanClass,
  config: configClass,
  dedupe: dedupClass,
  dev: developClass,
  develop: developClass,
  disable: disableClass,
  docs: docsClass,
  home: docsClass,
  open: docsClass,
  enable: enableClass,
  featured: featuredClass,
  init: initClass,
  install: installClass,
  i: installClass,
  link: linkClass,
  ln: linkClass,
  linked: linksClass,
  links: linksClass,
  lns: linksClass,
  list: listClass,
  ls: listClass,
  login: loginClass,
  publish: publishClass,
  "rebuild-module-cache": rebuildModuleCacheClass,
  rebuild: rebuildClass,
  search: searchClass,
  star: starClass,
  stars: starsClass,
  starred: starsClass,
  test: testClass,
  deinstall: uninstallClass,
  delete: uninstallClass,
  erase: uninstallClass,
  remove: uninstallClass,
  rm: uninstallClass,
  uninstall: uninstallClass,
  unlink: unlinkClass,
  unpublish: unpublishClass,
  unstar: unstarClass,
  upgrade: upgradeClass,
  outdated: upgradeClass,
  update: upgradeClass,
  view: viewClass,
  show: viewClass,
}

function parseOptions(args = []) {
  const options = yargs(args).wrap(Math.min(100, yargs.terminalWidth()))
  options.usage(`\

apm - Atom Package Manager powered by https://atom.io

Usage: apm <command>

where <command> is one of:
${wordwrap(4, 80)(Object.keys(commands).sort().join(", "))}.

Run \`apm help <command>\` to see the more details about a specific command.\
`)
  options.alias("v", "version").describe("version", "Print the apm version")
  options.alias("h", "help").describe("help", "Print this usage message")
  options.boolean("color").default("color", true).describe("color", "Enable colored output")
  options.command = options.argv._[0]
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]
    if (arg === options.command) {
      options.commandArgs = args.slice(index + 1)
      break
    }
  }
  return options
}

function showHelp(options) {
  if (options == null) {
    return
  }

  let help = options.help()
  if (help.indexOf("Options:") >= 0) {
    help += "\n  Prefix an option with `no-` to set it to false such as --no-color to disable"
    help += "\n  colored output."
  }

  return console.error(help)
}

function printVersions(args, callback) {
  let left, left1
  const apmVersion = (left = require("../package.json").version) != null ? left : ""
  const npmVersion = (left1 = require("npm/package.json").version) != null ? left1 : ""
  const nodeVersion = process.versions.node != null ? process.versions.node : ""

  return getPythonVersion((pythonVersion) =>
    git.getGitVersion((gitVersion) =>
      getAtomVersion(function (atomVersion) {
        let versions
        if (args.json) {
          versions = {
            apm: apmVersion,
            npm: npmVersion,
            node: nodeVersion,
            atom: atomVersion,
            python: pythonVersion,
            git: gitVersion,
            nodeArch: process.arch,
          }
          if (config.isWin32()) {
            versions.visualStudio = config.getInstalledVisualStudioFlag()
          }
          console.log(JSON.stringify(versions))
        } else {
          if (pythonVersion == null) {
            pythonVersion = ""
          }
          if (gitVersion == null) {
            gitVersion = ""
          }
          if (atomVersion == null) {
            atomVersion = ""
          }
          versions = `\
${"apm".red}  ${apmVersion.red}
${"npm".green}  ${npmVersion.green}
${"node".blue} ${nodeVersion.blue} ${process.arch.blue}
${"atom".cyan} ${atomVersion.cyan}
${"python".yellow} ${pythonVersion.yellow}
${"git".magenta} ${gitVersion.magenta}\
`

          if (config.isWin32()) {
            let left2
            const visualStudioVersion = (left2 = config.getInstalledVisualStudioFlag()) != null ? left2 : ""
            versions += `\n${"visual studio".cyan} ${visualStudioVersion.cyan}`
          }

          console.log(versions)
        }
        return callback()
      })
    )
  )
}

function getAtomVersion(callback) {
  return config.getResourcePath(function (resourcePath) {
    const unknownVersion = "unknown"
    try {
      let left
      const { version } = (left = require(path.join(resourcePath, "package.json"))) != null ? left : unknownVersion
      return callback(version)
    } catch (error) {
      return callback(unknownVersion)
    }
  })
}

function getPythonVersion(callback) {
  const npmOptions = {
    userconfig: config.getUserConfigPath(),
    globalconfig: config.getGlobalConfigPath(),
  }
  return npm.load(npmOptions, function () {
    let left
    let python = (left = npm.config.get("python")) != null ? left : process.env.PYTHON
    if (config.isWin32() && !python) {
      let rootDir = process.env.SystemDrive != null ? process.env.SystemDrive : "C:\\"
      if (rootDir[rootDir.length - 1] !== "\\") {
        rootDir += "\\"
      }
      const pythonExe = path.resolve(rootDir, "Python27", "python.exe")
      if (fs.isFileSync(pythonExe)) {
        python = pythonExe
      }
    }

    if (python == null) {
      python = "python"
    }

    const spawned = spawn(python, ["--version"])
    const outputChunks = []
    spawned.stderr.on("data", (chunk) => outputChunks.push(chunk))
    spawned.stdout.on("data", (chunk) => outputChunks.push(chunk))
    spawned.on("error", function () {
      /* ignore error */
    })
    return spawned.on("close", function (code) {
      let version
      if (code === 0) {
        ;[, version] = Array.from(Buffer.concat(outputChunks).toString().split(" "))
        version = version?.trim()
      }
      return callback(version)
    })
  })
}

export function run(args, callback) {
  let Command
  config.setupApmRcFile()
  const options = parseOptions(args)

  if (!options.argv.color) {
    colors.disable()
  }

  let callbackCalled = false
  const handleErrorCallback = (error) => {
    if (callbackCalled) {
      return
    }
    callbackCalled = true
    if (error != null) {
      let message
      if (typeof error === "string") {
        message = error
      } else {
        message = error.message != null ? error.message : error
      }

      if (message === "canceled") {
        // A prompt was canceled so just log an empty line
        console.log()
      } else if (message) {
        console.error(message.red)
      }
    }
    return callback?.(error)
  }

  args = options.argv
  const { command } = options
  if (args.version) {
    return printVersions(args, handleErrorCallback)
  } else if (args.help) {
    if ((Command = commands[options.command]?.())) {
      showHelp(new Command().parseOptions?.(options.command))
    } else {
      showHelp(options)
    }
    return handleErrorCallback()
  } else if (command) {
    if (command === "help") {
      if ((Command = commands[options.commandArgs]?.())) {
        showHelp(new Command().parseOptions?.(options.commandArgs))
      } else {
        showHelp(options)
      }
      return handleErrorCallback()
    } else if ((Command = commands[command]?.())) {
      return new Command().run(options, handleErrorCallback)
    } else {
      return handleErrorCallback(`Unrecognized command: ${command}`)
    }
  } else {
    showHelp(options)
    return handleErrorCallback()
  }
}
