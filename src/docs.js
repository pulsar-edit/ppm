
const yargs = require('yargs');
const open = require('open');

const View = require('./view');
const config = require('./apm');

module.exports =
class Docs extends View {
  static promiseBased = true;
  static commandNames = [ "docs", "home", "open" ];

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
      return new Promise((resolve, _reject) => {
        options = this.parseOptions(options.commandArgs);
        const [packageName] = options.argv._;

        if (!packageName) {
          resolve("Missing required package name");
          return;
        }

        this.getPackage(packageName, options, (error, pack) => {
          let repository;
          if (error != null) { return void resolve(error); }

          if (repository = this.getRepository(pack)) {
            if (options.argv.print) {
              console.log(repository);
            } else {
              this.openRepositoryUrl(repository);
            }
            return void resolve();
          } else {
            return void resolve(`Package \"${packageName}\" does not contain a repository URL`);
          }
        });
      });
    }
  }
