// Package helpers
module.exports = {
  // Parse the repository in `name/owner` format from the package metadata.
  //
  // pack - The package metadata object.
  //
  // Returns a name/owner string or null if not parseable.
  getRepository(pack) {
    pack ??= {};
    let repository = pack.repository?.url ?? pack.repository;
    if (repository) {
      const repoUrl = repository.replace(/\.git$/, '');
      if (!URL.canParse(repoUrl)) { return null; }
      const repoPath = new URL(repoUrl).pathname;
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
    pack ??= {};
    return pack.repository?.url ?? pack.repository ?? "origin";
  }
};
