
const path = require('path');

const _ = require('underscore-plus');
const async = require('async');
const CSON = require('season');
const yargs = require('yargs');

const config = require('./apm');
const Command = require('./command');
const fs = require('./fs');
const Login = require('./login');
const Packages = require('./packages');
const request = require('./request');

module.exports =
class Star extends Command {
  static commandNames = [ "star" ];

    parseOptions(argv) {
      const options = yargs(argv).wrap(Math.min(100, yargs.terminalWidth()));
      options.usage(`\

Usage: ppm star <package_name>...

Star the given packages

Run \`ppm stars\` to see all your starred packages.\
`
      );
      options.alias('h', 'help').describe('help', 'Print this usage message');
      return options.boolean('installed').describe('installed', 'Star all packages in ~/.pulsar/packages');
    }

    starPackage(packageName, param, callback) {
      if (param == null) { param = {}; }
      const {ignoreUnpublishedPackages, token} = param;
      if (process.platform === 'darwin') { process.stdout.write('\u2B50  '); }
      process.stdout.write(`Starring ${packageName} `);
      const requestSettings = {
        json: true,
        url: `${config.getAtomPackagesUrl()}/${packageName}/star`,
        headers: {
          authorization: token
        }
      };
      request.post(requestSettings, (error, response, body) => {
        if (body == null) { body = {}; }
        if (error != null) {
          this.logFailure();
          return callback(error);
        } else if ((response.statusCode === 404) && ignoreUnpublishedPackages) {
          process.stdout.write('skipped (not published)\n'.yellow);
          return callback();
        } else if (response.statusCode !== 200) {
          this.logFailure();
          const message = request.getErrorMessage(error);
          return callback(`Starring package failed: ${message}`);
        } else {
          this.logSuccess();
          return callback();
        }
      });
    }

    getInstalledPackageNames() {
      const installedPackages = [];
      const userPackagesDirectory = path.join(config.getAtomDirectory(), 'packages');
      for (let child of fs.list(userPackagesDirectory)) {
        if (!fs.isDirectorySync(path.join(userPackagesDirectory, child))) { continue; }

        let manifestPath = CSON.resolve(path.join(userPackagesDirectory, child, "package"));
        if (manifestPath) {
          try {
            const metadata = CSON.readFileSync(manifestPath) ?? {};
            if (metadata.name && Packages.getRepository(metadata)) {
              installedPackages.push(metadata.name);
            }
          } catch (error) {}
        }
      }

      return _.uniq(installedPackages);
    }

    run(options) {
      let packageNames;
      const {callback} = options;
      options = this.parseOptions(options.commandArgs);

      if (options.argv.installed) {
        packageNames = this.getInstalledPackageNames();
        if (packageNames.length === 0) {
          callback();
          return;
        }
      } else {
        packageNames = this.packageNamesFromArgv(options.argv);
        if (packageNames.length === 0) {
          callback("Please specify a package name to star");
          return;
        }
      }

      Login.getTokenOrLogin((error, token) => {
        if (error != null) { return callback(error); }

        const starOptions = {
          ignoreUnpublishedPackages: options.argv.installed,
          token
        };

        const commands = packageNames.map(packageName => {
          return callback => this.starPackage(packageName, starOptions, callback);
        });
        return async.waterfall(commands, callback);
      });
    }
  }
