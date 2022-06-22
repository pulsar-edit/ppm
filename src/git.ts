/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 */
import { spawn } from "child_process"
import path from "path"
import npm from "npm"
import * as config from "./apm"
import fs from "./fs"

function addPortableGitToEnv(env: Record<string, string | undefined>) {
  let children: string[]
  const localAppData = env.LOCALAPPDATA
  if (!localAppData) {
    return
  }

  const githubPath = path.join(localAppData, "GitHub")

  try {
    children = fs.readdirSync(githubPath)
  } catch (error) {
    return
  }

  for (const child of children) {
    if (child.indexOf("PortableGit_") === 0) {
      const cmdPath = path.join(githubPath, child, "cmd")
      const binPath = path.join(githubPath, child, "bin")
      let corePath = path.join(githubPath, child, "mingw64", "libexec", "git-core")
      if (!fs.isDirectorySync(corePath)) {
        corePath = path.join(githubPath, child, "mingw32", "libexec", "git-core")
      }

      if (env.Path) {
        env.Path += `${path.delimiter}${cmdPath}${path.delimiter}${binPath}${path.delimiter}${corePath}`
      } else {
        env.Path = `${cmdPath}${path.delimiter}${binPath}${path.delimiter}${corePath}`
      }
      break
    }
  }
}

function addGitBashToEnv(env: Record<string, string | undefined>) {
  // First, check ProgramW6432, as it will _always_ point to the 64-bit Program Files directory
  let gitPath: string
  if (env.ProgramW6432) {
    gitPath = path.join(env.ProgramW6432, "Git")
  }

  // Next, check ProgramFiles - this will point to:
  // - x64 Program Files when running a 64-bit process on 64-bit Windows
  // - x86 Program Files when running a 32-bit process on 64-bit Windows
  // - x86 Program Files when running on 32-bit Windows
  if (!fs.isDirectorySync(gitPath)) {
    if (env.ProgramFiles) {
      gitPath = path.join(env.ProgramFiles, "Git")
    }
  }

  // Finally, check ProgramFiles(x86) to see if 32-bit Git was installed on 64-bit Windows

  if (!fs.isDirectorySync(gitPath)) {
    if (env["ProgramFiles(x86)"]) {
      gitPath = path.join(env["ProgramFiles(x86)"], "Git")
    }
  }

  if (!fs.isDirectorySync(gitPath)) {
    return
  }

  const cmdPath = path.join(gitPath, "cmd")
  const binPath = path.join(gitPath, "bin")
  let corePath = path.join(gitPath, "mingw64", "libexec", "git-core")
  if (!fs.isDirectorySync(corePath)) {
    corePath = path.join(gitPath, "mingw32", "libexec", "git-core")
  }

  if (env.Path) {
    return (env.Path += `${path.delimiter}${cmdPath}${path.delimiter}${binPath}${path.delimiter}${corePath}`)
  } else {
    return (env.Path = `${cmdPath}${path.delimiter}${binPath}${path.delimiter}${corePath}`)
  }
}

export function addGitToEnv(env: Record<string, string | undefined>) {
  if (process.platform !== "win32") {
    return
  }
  addPortableGitToEnv(env)
  return addGitBashToEnv(env)
}

export function getGitVersion(callback: (version: string) => any) {
  npm.config.defs = {
    defaults: {
      userconfig: config.getUserConfigPath(),
      globalconfig: config.getGlobalConfigPath(),
    },
    types: undefined,
  }
  return npm.load(function () {
    const git = (npm.config.get("git") as string | undefined) ?? "git"
    addGitToEnv(process.env)
    const spawned = spawn(git, ["--version"])
    const outputChunks = []
    spawned.stderr.on("data", (chunk) => outputChunks.push(chunk))
    spawned.stdout.on("data", (chunk) => outputChunks.push(chunk))
    spawned.on("error", function () {
      /* ignore error */
    })
    return spawned.on("close", function (code) {
      let version: string
      if (code === 0) {
        ;[, , version] = Array.from(Buffer.concat(outputChunks).toString().split(" "))
        version = version?.trim()
      }
      return callback(version)
    })
  })
}
