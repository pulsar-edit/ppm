
const async = require('async');
const yargs = require('yargs');

const config = require('./apm');
const Command = require('./command');
const Login = require('./login');
const request = require('./request');

module.exports =
class Unstar extends Command {
  static commandNames = [ "unstar" ];

    parseOptions(argv) {
      const options = yargs(argv).wrap(Math.min(100, yargs.terminalWidth()));
      options.usage(`\

Usage: ppm unstar <package_name>...

Unstar the given packages

Run \`ppm stars\` to see all your starred packages.\
`
      );
      return options.alias('h', 'help').describe('help', 'Print this usage message');
    }

    starPackage(packageName, token) {
      if (process.platform === 'darwin') { process.stdout.write('\uD83D\uDC5F \u2B50  '); }
      process.stdout.write(`Unstarring ${packageName} `);
      const requestSettings = {
        json: true,
        url: `${config.getAtomPackagesUrl()}/${packageName}/star`,
        headers: {
          authorization: token
        }
      };
      return new Promise((resolve, reject) => {
        request.del(requestSettings, (error, response, body) => {
          body ??= {};
          if (error != null) {
            this.logFailure();
            return void reject(error);
          }
          if (response.statusCode !== 204) {
            this.logFailure();
            const message = request.getErrorMessage(body, error);
            return void reject(`Unstarring package failed: ${message}`);
          }

          this.logSuccess();
          resolve();
        });
      });
    }

    async run(options) {
      options = this.parseOptions(options.commandArgs);
      const packageNames = this.packageNamesFromArgv(options.argv);

      if (packageNames.length === 0) {
        return "Please specify a package name to unstar"; // error as return value atm
      }

      try {
        const token = await Login.getTokenOrLogin();
        const commands = packageNames.map(packageName => {
          return async () => await this.starPackage(packageName, token);
        });
        return await async.waterfall(commands);
      } catch (error) {
        return error; // error as return value atm
      }
    }
  }
