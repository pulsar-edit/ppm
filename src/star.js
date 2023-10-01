
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

    starPackage(packageName, param) {
      param ??= {};
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

      return new Promise((resolve, reject) => {
        request.post(requestSettings, (error, response, body) => {
          body ??= {};
          if (error != null) {
            this.logFailure();
            return void reject(error);
          }
          if ((response.statusCode === 404) && ignoreUnpublishedPackages) {
            process.stdout.write('skipped (not published)\n'.yellow);
            return void reject();
          }
          if (response.statusCode !== 200) {
            this.logFailure();
            const message = request.getErrorMessage(body, error);
            return void reject(`Starring package failed: ${message}`);
          }

          this.logSuccess();
          resolve();
        });
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

    async run(options) {
      let packageNames;
      options = this.parseOptions(options.commandArgs);

      if (options.argv.installed) {
        packageNames = this.getInstalledPackageNames();
        if (packageNames.length === 0) {
          return;
        }
      } else {
        packageNames = this.packageNamesFromArgv(options.argv);
        if (packageNames.length === 0) {
          return "Please specify a package name to star"; // error as return value for now
        }
      }

      try {
        const token = await Login.getTokenOrLogin();
        const starOptions = {
          ignoreUnpublishedPackages: options.argv.installed,
          token
        };
        const commands = packageNames.map(packageName => {
          return async () => await this.starPackage(packageName, starOptions);
        });
        return await async.waterfall(commands);
      } catch (error) {
        return error; // error as return value
      }
    }
  }
