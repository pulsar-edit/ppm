
const path = require('path');
const readline = require('readline');

const yargs = require('yargs');

const auth = require('./auth');
const Command = require('./command');
const config = require('./apm');
const fs = require('./fs');
const request = require('./request');

module.exports =
class Unpublish extends Command {
  static promiseBased = true;
  static commandNames = [ "unpublish" ];

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

    async unpublishPackage(packageName, packageVersion) {
      let packageLabel = packageName;
      if (packageVersion) { packageLabel += `@${packageVersion}`; }

      process.stdout.write(`Unpublishing ${packageLabel} `);

      try {
        const token = await auth.getToken();
        const options = {
          url: `${config.getAtomPackagesUrl()}/${packageName}`,
          headers: {
            authorization: token
          },
          json: true
        };

        if (packageVersion) { options.url += `/versions/${packageVersion}`; }

        return new Promise((resolve, reject) =>{
          request.del(options, (error, response, body) => {
            body ??= {};
            if (error != null) {
              this.logFailure();
              return void reject(error);
            }
            if (response.statusCode !== 204) {
              this.logFailure();
              const message = body.message ?? body.error ?? body;
              return void reject(`Unpublishing failed: ${message}`);
            }

            this.logSuccess();
            resolve();
          });
        });
      } catch (error) {
          this.logFailure();
          throw error;
      }
    }

    async promptForConfirmation(packageName, packageVersion) {
      let packageLabel = packageName;
      if (packageVersion) { packageLabel += `@${packageVersion}`; }

      const question = packageVersion
        ? `Are you sure you want to unpublish '${packageLabel}'? (no) `
        : `Are you sure you want to unpublish ALL VERSIONS of '${packageLabel}'? ` +
          "This will remove it from the ppm registry, including " +
          "download counts and stars, and will render the package " +
          "name permanently unusable. This action is irreversible. (no)";

      let answer = await this.prompt(question);
      answer = answer ? answer.trim().toLowerCase() : 'no';
      if (['y', 'yes'].includes(answer)) {
        await this.unpublishPackage(packageName, packageVersion);
      } else {
        return `Cancelled unpublishing ${packageLabel}`;
      }
    }

    prompt(question) {
      const prompt = readline.createInterface(process.stdin, process.stdout);

      return new Promise((resolve, _reject) => {
        prompt.question(question, answer => {
          prompt.close();
          resolve(answer);
        });
      });
    }

    async run(options) {
      let version;
      options = this.parseOptions(options.commandArgs);
      let [name] = options.argv._;

      if (name?.length > 0) {
        const atIndex = name.indexOf('@');
        if (atIndex !== -1) {
          version = name.substring(atIndex + 1);
          name = name.substring(0, atIndex);
        }
      }

      if (!name) {
        try {
          name = JSON.parse(fs.readFileSync('package.json'))?.name;
        } catch (error) {}
      }
      name ||= path.basename(process.cwd());

      if (options.argv.force) {
        return await this.unpublishPackage(name, version).catch(error => error); //errors as values atm
      }

      return await this.promptForConfirmation(name, version).catch(error => error); //errors as values atm
    }
  }
