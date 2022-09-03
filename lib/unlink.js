/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS104: Avoid inline assignments
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
let Unlink;
const path = require("path");

const CSON = require("season");
const yargs = require("yargs");

const Command = require("./command");
const config = require("./apm");
const fs = require("./fs");

module.exports = Unlink = (function () {
  Unlink = class Unlink extends Command {
    static initClass() {
      this.commandNames = ["unlink"];
    }

    constructor() {
      super();
      this.devPackagesPath = path.join(
        config.getAtomDirectory(),
        "dev",
        "packages"
      );
      this.packagesPath = path.join(config.getAtomDirectory(), "packages");
    }

    parseOptions(argv) {
      const options = yargs(argv).wrap(Math.min(100, yargs.terminalWidth()));
      options.usage(`\

Usage: apm unlink [<package_path>]

Delete the symlink in ~/.atom/packages for the package. The package in the
current working directory is unlinked if no path is given.

Run \`apm links\` to view all the currently linked packages.\
`);
      options.alias("h", "help").describe("help", "Print this usage message");
      options
        .alias("d", "dev")
        .boolean("dev")
        .describe("dev", "Unlink package from ~/.atom/dev/packages");
      options
        .boolean("hard")
        .describe(
          "hard",
          "Unlink package from ~/.atom/packages and ~/.atom/dev/packages"
        );
      return options
        .alias("a", "all")
        .boolean("all")
        .describe(
          "all",
          "Unlink all packages in ~/.atom/packages and ~/.atom/dev/packages"
        );
    }

    getDevPackagePath(packageName) {
      return path.join(this.devPackagesPath, packageName);
    }

    getPackagePath(packageName) {
      return path.join(this.packagesPath, packageName);
    }

    unlinkPath(pathToUnlink) {
      try {
        process.stdout.write(`Unlinking ${pathToUnlink} `);
        fs.unlinkSync(pathToUnlink);
        return this.logSuccess();
      } catch (error) {
        this.logFailure();
        throw error;
      }
    }

    unlinkAll(options, callback) {
      try {
        let child, packagePath;
        for (child of Array.from(fs.list(this.devPackagesPath))) {
          packagePath = path.join(this.devPackagesPath, child);
          if (fs.isSymbolicLinkSync(packagePath)) {
            this.unlinkPath(packagePath);
          }
        }
        if (!options.argv.dev) {
          for (child of Array.from(fs.list(this.packagesPath))) {
            packagePath = path.join(this.packagesPath, child);
            if (fs.isSymbolicLinkSync(packagePath)) {
              this.unlinkPath(packagePath);
            }
          }
        }
        return callback();
      } catch (error) {
        return callback(error);
      }
    }

    unlinkPackage(options, callback) {
      let error, left, packageName;
      const packagePath =
        (left =
          options.argv._[0] != null
            ? options.argv._[0].toString()
            : undefined) != null
          ? left
          : ".";
      const linkPath = path.resolve(process.cwd(), packagePath);

      try {
        packageName = CSON.readFileSync(
          CSON.resolve(path.join(linkPath, "package"))
        ).name;
      } catch (error3) {}
      if (!packageName) {
        packageName = path.basename(linkPath);
      }

      if (options.argv.hard) {
        try {
          this.unlinkPath(this.getDevPackagePath(packageName));
          this.unlinkPath(this.getPackagePath(packageName));
          return callback();
        } catch (error1) {
          error = error1;
          return callback(error);
        }
      } else {
        let targetPath;
        if (options.argv.dev) {
          targetPath = this.getDevPackagePath(packageName);
        } else {
          targetPath = this.getPackagePath(packageName);
        }
        try {
          this.unlinkPath(targetPath);
          return callback();
        } catch (error2) {
          error = error2;
          return callback(error);
        }
      }
    }

    run(options) {
      const { callback } = options;
      options = this.parseOptions(options.commandArgs);

      if (options.argv.all) {
        return this.unlinkAll(options, callback);
      } else {
        return this.unlinkPackage(options, callback);
      }
    }
  };
  Unlink.initClass();
  return Unlink;
})();
