/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const _ = require("underscore-plus");
const fs = require("fs-plus");
const ncp = require("ncp");
const rm = require("rimraf");
const wrench = require("wrench");
const path = require("path");

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

  cp(sourcePath, destinationPath, callback) {
    return rm(destinationPath, function (error) {
      if (error != null) {
        return callback(error);
      } else {
        return ncp(sourcePath, destinationPath, callback);
      }
    });
  },

  mv(sourcePath, destinationPath, callback) {
    return rm(destinationPath, function (error) {
      if (error != null) {
        return callback(error);
      } else {
        wrench.mkdirSyncRecursive(path.dirname(destinationPath), 0o755);
        return fs.rename(sourcePath, destinationPath, callback);
      }
    });
  },
};

module.exports = new Proxy(
  {},
  {
    get(target, key) {
      return fsAdditions[key] || fs[key];
    },

    set(target, key, value) {
      return (fsAdditions[key] = value);
    },
  }
);
