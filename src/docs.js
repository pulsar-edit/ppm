/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
let Docs;
const yargs = require('yargs');
const open = require('open');

const View = require('./view');
const config = require('./apm');

module.exports =
(Docs = (function() {
  Docs = class Docs extends View {
    static initClass() {
      this.commandNames = ['docs', 'home', 'open'];
    }

    parseOptions(argv) {
      const options = yargs(argv).wrap(Math.min(100, yargs.terminalWidth()));
      options.usage(`\

Usage: ppm docs [options] <package_name>

Open a package's homepage in the default browser.\
`
      );
      options.alias('h', 'help').describe('help', 'Print this usage message');
      return options.boolean('p').alias('p', 'print').describe('print', 'Print the URL instead of opening it');
    }

    openRepositoryUrl(repositoryUrl) {
      return open(repositoryUrl);
    }

    run(options) {
      const {callback} = options;
      options = this.parseOptions(options.commandArgs);
      const [packageName] = options.argv._;

      if (!packageName) {
        callback("Missing required package name");
        return;
      }

      return this.getPackage(packageName, options, (error, pack) => {
        let repository;
        if (error != null) { return callback(error); }

        if (repository = this.getRepository(pack)) {
          if (options.argv.print) {
            console.log(repository);
          } else {
            this.openRepositoryUrl(repository);
          }
          return callback();
        } else {
          return callback(`Package \"${packageName}\" does not contain a repository URL`);
        }
      });
    }
  };
  Docs.initClass();
  return Docs;
})());
