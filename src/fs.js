
const _ = require('underscore-plus');
const fs = require('fs-plus');
const ncp = require('ncp');
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
      fs.rm(destinationPath, { recursive: true, force: true }).then(() => {
        ncp(sourcePath, destinationPath, (error, value) => void (error != null ? reject(error) : resolve(value)));
      }).catch((error) => {
        return reject(error);
      });
    });
  },

  mv(sourcePath, destinationPath) {
    return new Promise((resolve, reject) => {
      fs.rm(destinationPath, { recursive: true, force: true }).then(() => {
        wrench.mkdirSyncRecursive(path.dirname(destinationPath), 0o755);
        fs.rename(sourcePath, destinationPath, (error, value) => void (error != null ? reject(error) : resolve(value)));
      }).catch((error) => {
        return reject(error);
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
