
const url = require('url');

// Package helpers
module.exports = {
  // Parse the repository in `name/owner` format from the package metadata.
  //
  // pack - The package metadata object.
  //
  // Returns a name/owner string or null if not parseable.
  getRepository(pack) {
    if (pack == null) { pack = {}; }
    let repository = pack.repository?.url ?? pack.repository;
    if (repository) {
      const repoPath = url.parse(repository.replace(/\.git$/, '')).pathname;
      const [name, owner] = repoPath.split('/').slice(-2);
      if (name && owner) { return `${name}/${owner}`; }
    }
    return null;
  },

  // Determine remote from package metadata.
  //
  // pack - The package metadata object.
  // Returns a the remote or 'origin' if not parseable.
  getRemote(pack) {
    if (pack == null) { pack = {}; }
    return pack.repository?.url ?? pack.repository ?? "origin";
  }
};
