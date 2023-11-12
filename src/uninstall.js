
const path = require('path');

const async = require('async');
const CSON = require('season');
const yargs = require('yargs');

const auth = require('./auth');
const Command = require('./command');
const config = require('./apm');
const fs = require('./fs');
const request = require('./request');

module.exports =
class Uninstall extends Command {
  static commandNames = [ "deinstall", "delete", "erase", "remove", "rm", "uninstall" ];

    parseOptions(argv) {
      const options = yargs(argv).wrap(Math.min(100, yargs.terminalWidth()));
      options.usage(`\

Usage: ppm uninstall <package_name>...

Delete the installed package(s) from the ~/.pulsar/packages directory.\
`
      );
      options.alias('h', 'help').describe('help', 'Print this usage message');
      options.alias('d', 'dev').boolean('dev').describe('dev', 'Uninstall from ~/.pulsar/dev/packages');
      return options.boolean('hard').describe('hard', 'Uninstall from ~/.pulsar/packages and ~/.pulsar/dev/packages');
    }

    getPackageVersion(packageDirectory) {
      try {
        return CSON.readFileSync(path.join(packageDirectory, 'package.json'))?.version;
      } catch (error) {
        return null;
      }
    }

    async registerUninstall({packageName, packageVersion}) {
      if (!packageVersion) { return; }

      try {
        const token = await auth.getToken();
        const requestOptions = {
          url: `${config.getAtomPackagesUrl()}/${packageName}/versions/${packageVersion}/events/uninstall`,
          json: true,
          headers: {
            authorization: token
          }
        };
        return new Promise((resolve, _reject) => void request.post(requestOptions, (_error, _response, _body) => resolve()));
      } catch (error) {
        return error; // error as value here
      }
    }

    async run(options) {
      options = this.parseOptions(options.commandArgs);
      const packageNames = this.packageNamesFromArgv(options.argv);

      if (packageNames.length === 0) {
        return "Please specify a package name to uninstall"; // error as return value atm
      }

      const packagesDirectory = path.join(config.getAtomDirectory(), 'packages');
      const devPackagesDirectory = path.join(config.getAtomDirectory(), 'dev', 'packages');

      const uninstallsToRegister = [];
      let uninstallError = null;

      for (let packageName of Array.from(packageNames)) {
        if (packageName === '.') {
          packageName = path.basename(process.cwd());
        }
        process.stdout.write(`Uninstalling ${packageName} `);
        try {
          let packageDirectory;
          if (!options.argv.dev) {
            packageDirectory = path.join(packagesDirectory, packageName);
            const packageManifestPath = path.join(packageDirectory, 'package.json');
            if (fs.existsSync(packageManifestPath)) {
              const packageVersion = this.getPackageVersion(packageDirectory);
              fs.removeSync(packageDirectory);
              if (packageVersion) {
                uninstallsToRegister.push({packageName, packageVersion});
              }
            } else if (!options.argv.hard) {
              throw new Error(`No package.json found at ${packageManifestPath}`);
            }
          }

          if (options.argv.hard || options.argv.dev) {
            packageDirectory = path.join(devPackagesDirectory, packageName);
            if (fs.existsSync(packageDirectory)) {
              fs.removeSync(packageDirectory);
            } else if (!options.argv.hard) {
              throw new Error("Does not exist");
            }
          }

          this.logSuccess();
        } catch (error) {
          this.logFailure();
          uninstallError = new Error(`Failed to delete ${packageName}: ${error.message}`);
          break;
        }
      }

      await async.eachSeries(uninstallsToRegister, (data, errorHandler) =>void this.registerUninstall(data).then(errorHandler));
      return uninstallError; // both error and lack of error, as return value atm
    }
  }
