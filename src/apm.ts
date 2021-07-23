/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import child_process from "child_process"
import fs from "./fs"
import path from "path"
import npm from "npm"
let asarPath = null

export function getHomeDirectory() {
  if (process.platform === "win32") {
    return process.env.USERPROFILE
  } else {
    return process.env.HOME
  }
}

export function getAtomDirectory() {
  return process.env.ATOM_HOME != null ? process.env.ATOM_HOME : path.join(getHomeDirectory(), ".atom")
}

export function getRustupHomeDirPath() {
  if (process.env.RUSTUP_HOME) {
    return process.env.RUSTUP_HOME
  } else {
    return path.join(getHomeDirectory(), ".multirust")
  }
}

export function getCacheDirectory() {
  return path.join(getAtomDirectory(), ".apm")
}

export function getResourcePath(callback) {
  if (process.env.ATOM_RESOURCE_PATH) {
    return process.nextTick(() => callback(process.env.ATOM_RESOURCE_PATH))
  }

  if (asarPath) {
    // already calculated
    return process.nextTick(() => callback(asarPath))
  }

  let apmFolder = path.resolve(__dirname, "..")
  let appFolder = path.dirname(apmFolder)
  if (path.basename(apmFolder) === "apm" && path.basename(appFolder) === "app") {
    asarPath = `${appFolder}.asar`
    if (fs.existsSync(asarPath)) {
      return process.nextTick(() => callback(asarPath))
    }
  }

  apmFolder = path.resolve(__dirname, "..", "..", "..")
  appFolder = path.dirname(apmFolder)
  if (path.basename(apmFolder) === "apm" && path.basename(appFolder) === "app") {
    asarPath = `${appFolder}.asar`
    if (fs.existsSync(asarPath)) {
      return process.nextTick(() => callback(asarPath))
    }
  }

  let glob, pattern, asarPaths

  switch (process.platform) {
    case "darwin":
      return child_process.exec(
        "mdfind \"kMDItemCFBundleIdentifier == 'com.github.atom'\"",
        function (error, stdout = "") {
          let appLocation
          if (!error) {
            ;[appLocation] = Array.from(stdout.split("\n"))
          }
          if (!appLocation) {
            appLocation = "/Applications/Atom.app"
          }
          asarPath = `${appLocation}/Contents/Resources/app.asar`
          return process.nextTick(() => callback(asarPath))
        }
      )
    case "linux":
      asarPath = "/usr/local/share/atom/resources/app.asar"
      if (!fs.existsSync(asarPath)) {
        asarPath = "/usr/share/atom/resources/app.asar"
      }
      return process.nextTick(() => callback(asarPath))
    case "win32":
      glob = require("glob")
      pattern = `/Users/${process.env.USERNAME}/AppData/Local/atom/app-+([0-9]).+([0-9]).+([0-9])/resources/app.asar`
      asarPaths = glob.sync(pattern, null) // [] | a sorted array of locations with the newest version being last
      asarPath = asarPaths[asarPaths.length - 1]
      return process.nextTick(() => callback(asarPath))
    default:
      return process.nextTick(() => callback(""))
  }
}

export function getReposDirectory() {
  return process.env.ATOM_REPOS_HOME != null ? process.env.ATOM_REPOS_HOME : path.join(getHomeDirectory(), "github")
}

export function getElectronUrl() {
  return process.env.ATOM_ELECTRON_URL != null ? process.env.ATOM_ELECTRON_URL : "https://atom.io/download/electron"
}

export function getAtomPackagesUrl() {
  return process.env.ATOM_PACKAGES_URL != null ? process.env.ATOM_PACKAGES_URL : `${getAtomApiUrl()}/packages`
}

export function getAtomApiUrl() {
  return process.env.ATOM_API_URL != null ? process.env.ATOM_API_URL : "https://atom.io/api"
}

export function getElectronArch() {
  switch (process.platform) {
    case "darwin":
      return "x64"
    default:
      return process.env.ATOM_ARCH != null ? process.env.ATOM_ARCH : process.arch
  }
}

export function getUserConfigPath() {
  return path.resolve(getAtomDirectory(), ".apmrc")
}

export function getGlobalConfigPath() {
  return path.resolve(getAtomDirectory(), ".apm", ".apmrc")
}

export function isWin32() {
  return process.platform === "win32"
}

export function x86ProgramFilesDirectory() {
  return process.env["ProgramFiles(x86)"] || process.env.ProgramFiles
}

export function getInstalledVisualStudioFlag() {
  if (!isWin32()) {
    return null
  }

  // Use the explictly-configured version when set
  if (process.env.GYP_MSVS_VERSION) {
    return process.env.GYP_MSVS_VERSION
  }

  if (visualStudioIsInstalled("2019")) {
    return "2019"
  }
  if (visualStudioIsInstalled("2017")) {
    return "2017"
  }
  if (visualStudioIsInstalled("14.0")) {
    return "2015"
  }
}

export function visualStudioIsInstalled(version) {
  if (version < 2017) {
    return fs.existsSync(path.join(x86ProgramFilesDirectory(), `Microsoft Visual Studio ${version}`, "Common7", "IDE"))
  } else {
    return (
      fs.existsSync(
        path.join(x86ProgramFilesDirectory(), "Microsoft Visual Studio", `${version}`, "BuildTools", "Common7", "IDE")
      ) ||
      fs.existsSync(
        path.join(x86ProgramFilesDirectory(), "Microsoft Visual Studio", `${version}`, "Community", "Common7", "IDE")
      ) ||
      fs.existsSync(
        path.join(x86ProgramFilesDirectory(), "Microsoft Visual Studio", `${version}`, "Enterprise", "Common7", "IDE")
      ) ||
      fs.existsSync(
        path.join(x86ProgramFilesDirectory(), "Microsoft Visual Studio", `${version}`, "Professional", "Common7", "IDE")
      ) ||
      fs.existsSync(
        path.join(x86ProgramFilesDirectory(), "Microsoft Visual Studio", `${version}`, "WDExpress", "Common7", "IDE")
      )
    )
  }
}

export function loadNpm(callback) {
  const npmOptions = {
    userconfig: getUserConfigPath(),
    globalconfig: getGlobalConfigPath(),
  }
  return npm.load(npmOptions, () => callback(null, npm))
}

export function getSetting(key, callback) {
  return loadNpm(() => callback(npm.config.get(key)))
}

export function setupApmRcFile() {
  try {
    return fs.writeFileSync(
      getGlobalConfigPath(),
      `\
; This file is auto-generated and should not be edited since any
; modifications will be lost the next time any apm command is run.
;
; You should instead edit your .apmrc config located in ~/.atom/.apmrc
cache = ${getCacheDirectory()}
; Hide progress-bar to prevent npm from altering apm console output.
progress = false\
`
    )
  } catch (error) {
    /* ignore error */
  }
}
