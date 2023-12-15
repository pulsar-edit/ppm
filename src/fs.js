
const fs = require('fs-plus');
const ncp = require('ncp');
const rm = require('rimraf');
const wrench = require('wrench');
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
    return wrench.readdirSyncRecursive(directoryPath);
  },

  cp(sourcePath, destinationPath) {
    return new Promise((resolve, reject) => {
      rm(destinationPath, error => {
        if (error != null) {
          return reject(error);
        }
        ncp(sourcePath, destinationPath, (error, value) => void (error != null ? reject(error) : resolve(value)));
      });
    });
  },

  mv(sourcePath, destinationPath) {
    return new Promise((resolve, reject) => {
      rm(destinationPath, error => {
        if (error != null) {
          return reject(error);
        }
        wrench.mkdirSyncRecursive(path.dirname(destinationPath), 0o755);
        fs.rename(sourcePath, destinationPath, (error, value) => void (error != null ? reject(error) : resolve(value)));
      });
    });
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
