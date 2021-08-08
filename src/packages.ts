/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import url from "url"

// Package helpers
// Parse the repository in `name/owner` format from the package metadata.
//
// pack - The package metadata object.
//
// Returns a name/owner string or null if not parseable.
export function getRepository(pack = {}) {
  let repository
  if ((repository = pack.repository?.url != null ? pack.repository?.url : pack.repository)) {
    const repoPath = url.parse(repository.replace(/\.git$/, "")).pathname
    const [name, owner] = Array.from(repoPath.split("/").slice(-2))
    if (name && owner) {
      return `${name}/${owner}`
    }
  }
  return null
}

// Determine remote from package metadata.
//
// pack - The package metadata object.
// Returns a the remote or 'origin' if not parseable.
export function getRemote(pack = {}) {
  return pack.repository?.url || pack.repository || "origin"
}
