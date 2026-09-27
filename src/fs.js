
const fs = require('fs-plus');
const fsPromises = require("fs/promises");
const path = require('path');

const fsAdditions = {
  list(directoryPath) {
    if (fs.isDirectorySync(directoryPath)) {
      try {
        return fs.readdirSync(directoryPath);
      } catch (e) {
        return [];
      }
    } else {
      return [];
    }
  },

  listRecursive(directoryPath) {
    return fsPromises.readdir(directoryPath, { recursive: true });
  },

  async cp(sourcePath, destinationPath) {
    await fsPromises.rm(destinationPath, { recursive: true, force: true });
    await fsPromises.cp(sourcePath, destinationPath, { recursive: true, verbatimSymlinks: true });
  },

  async mv(sourcePath, destinationPath) {
    await fsPromises.rm(destinationPath, { recursive: true, force: true });
    await fsPromises.mkdir(path.dirname(destinationPath), { mode: 0o755, recursive: true });
    try {
      await fsPromises.rename(sourcePath, destinationPath);
    } catch (err) {
      if (err.code !== 'EXDEV') throw err;
      // `rename` can't cross filesystem boundaries; copy, then remove the original.
      await fsPromises.cp(sourcePath, destinationPath, { recursive: true, verbatimSymlinks: true, preserveTimestamps: true });
      await fsPromises.rm(sourcePath, { recursive: true, force: true });
    }
  }
};

module.exports = new Proxy({}, {
  get(_target, key) {
    return fsAdditions[key] || fs[key];
  },

  set(_target, key, value) {
    return fsAdditions[key] = value;
  }
});
