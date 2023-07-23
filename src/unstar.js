
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
      options.alias('h', 'help').describe('help', 'Print this usage message');
    }

    starPackage(packageName, token, callback) {
      if (process.platform === 'darwin') { process.stdout.write('\uD83D\uDC5F \u2B50  '); }
      process.stdout.write(`Unstarring ${packageName} `);
      const requestSettings = {
        json: true,
        url: `${config.getAtomPackagesUrl()}/${packageName}/star`,
        headers: {
          authorization: token
        }
      };
      request.del(requestSettings, (error, response, body) => {
        if (body == null) { body = {}; }
        if (error != null) {
          this.logFailure();
          return callback(error);
        } else if (response.statusCode !== 204) {
          this.logFailure();
          const message = body.message ?? body.error ?? body;
          return callback(`Unstarring package failed: ${message}`);
        } else {
          this.logSuccess();
          return callback();
        }
      });
    }

    run(options) {
      const {callback} = options;
      options = this.parseOptions(options.commandArgs);
      const packageNames = this.packageNamesFromArgv(options.argv);

      if (packageNames.length === 0) {
        callback("Please specify a package name to unstar");
        return;
      }

      Login.getTokenOrLogin((error, token) => {
        if (error != null) { return callback(error); }

        const commands = packageNames.map(packageName => {
          return callback => this.starPackage(packageName, token, callback);
        });
        return async.waterfall(commands, callback);
      });
    }
  }
