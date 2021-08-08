/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import url from "url"
import { PackageMetadata } from "atom/src/package-manager"
export { PackageMetadata } from "atom/src/package-manager"

export const unkownPackage = { name: "unkown", version: "0.0.0" }

// Package helpers
// Parse the repository in `name/owner` format from the package metadata.
//
// pack - The package metadata object.
//
// Returns a name/owner string or null if not parseable.
export function getRepository(pack: PackageMetadata = unkownPackage) {
  const repository = getUrl(pack)
  if (repository) {
    const repoPath = url.parse(repository.replace(/\.git$/, "")).pathname
    const [name, owner] = Array.from(repoPath.split("/").slice(-2))
    if (name && owner) {
      return `${name}/${owner}`
    }
  }
  return null
}

// Determine remote from package metadata (url)
//
// pack - The package metadata object.
// Returns a the remote or 'origin' if not parseable.
export function getRemote(pack: PackageMetadata = unkownPackage) {
  return getUrl(pack) || "origin"
}

/** Get the repository */
function getUrl(pack: PackageMetadata = unkownPackage) {
  return typeof pack.repository === "object" && "url" in pack.repository ? pack.repository.url : pack.repository
}
