/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__, or convert again using --optional-chaining
 * DS104: Avoid inline assignments
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
let Unpublish;
const path = require('path');
const readline = require('readline');

const yargs = require('yargs');

const auth = require('./auth');
const Command = require('./command');
const config = require('./apm');
const fs = require('./fs');
const request = require('./request');

module.exports =
(Unpublish = (function() {
  Unpublish = class Unpublish extends Command {
    static initClass() {
      this.commandNames = ['unpublish'];
    }

    parseOptions(argv) {
      const options = yargs(argv).wrap(Math.min(100, yargs.terminalWidth()));

      options.usage(`\
Usage: ppm unpublish [<package_name>]
       ppm unpublish <package_name>@<package_version>

Remove a published package or package version.

The package in the current working directory will be used if no package
name is specified.\
`
      );
      options.alias('h', 'help').describe('help', 'Print this usage message');
      return options.alias('f', 'force').boolean('force').describe('force', 'Do not prompt for confirmation');
    }

    unpublishPackage(packageName, packageVersion, callback) {
      let packageLabel = packageName;
      if (packageVersion) { packageLabel += `@${packageVersion}`; }

      process.stdout.write(`Unpublishing ${packageLabel} `);

      return auth.getToken((error, token) => {
        if (error != null) {
          this.logFailure();
          callback(error);
          return;
        }

        const options = {
          uri: `${config.getAtomPackagesUrl()}/${packageName}`,
          headers: {
            authorization: token
          },
          json: true
        };

        if (packageVersion) { options.uri += `/versions/${packageVersion}`; }

        return request.del(options, (error, response, body) => {
          if (body == null) { body = {}; }
          if (error != null) {
            this.logFailure();
            return callback(error);
          } else if (response.statusCode !== 204) {
            let left;
            this.logFailure();
            const message = (left = body.message != null ? body.message : body.error) != null ? left : body;
            return callback(`Unpublishing failed: ${message}`);
          } else {
            this.logSuccess();
            return callback();
          }
        });
      });
    }

    promptForConfirmation(packageName, packageVersion, callback) {
      let question;
      let packageLabel = packageName;
      if (packageVersion) { packageLabel += `@${packageVersion}`; }

      if (packageVersion) {
        question = `Are you sure you want to unpublish '${packageLabel}'? (no) `;
      } else {
        question = `Are you sure you want to unpublish ALL VERSIONS of '${packageLabel}'? ` +
                   "This will remove it from the ppm registry, including " +
                   "download counts and stars, and this action is irreversible. (no)";
      }

      return this.prompt(question, answer => {
        answer = answer ? answer.trim().toLowerCase() : 'no';
        if (['y', 'yes'].includes(answer)) {
          return this.unpublishPackage(packageName, packageVersion, callback);
        } else {
          return callback(`Cancelled unpublishing ${packageLabel}`);
        }
      });
    }

    prompt(question, callback) {
      const prompt = readline.createInterface(process.stdin, process.stdout);

      return prompt.question(question, function(answer) {
        prompt.close();
        return callback(answer);
      });
    }

    run(options) {
      let version;
      const {callback} = options;
      options = this.parseOptions(options.commandArgs);
      let [name] = options.argv._;

      if ((name != null ? name.length : undefined) > 0) {
        const atIndex = name.indexOf('@');
        if (atIndex !== -1) {
          version = name.substring(atIndex + 1);
          name = name.substring(0, atIndex);
        }
      }

      if (!name) {
        try {
          name = __guard__(JSON.parse(fs.readFileSync('package.json')), x => x.name);
        } catch (error) {}
      }

      if (!name) {
        name = path.basename(process.cwd());
      }

      if (options.argv.force) {
        return this.unpublishPackage(name, version, callback);
      } else {
        return this.promptForConfirmation(name, version, callback);
      }
    }
  };
  Unpublish.initClass();
  return Unpublish;
})());

function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}
