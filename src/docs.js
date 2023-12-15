
const yargs = require('yargs');
const open = require('open');

const View = require('./view');

module.exports =
class Docs extends View {
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

    async run(options) {
      options = this.parseOptions(options.commandArgs);
      const [packageName] = options.argv._;

      if (!packageName) {
        return "Missing required package name"; //error as return value
      }

      let pack;
      try {
        pack = await this.getPackage(packageName, options);
      } catch (error) {
        return error; //error as return value
      }

      const repository = this.getRepository(pack);
      if (!repository) {
        return `Package \"${packageName}\" does not contain a repository URL`; //error as return value
      }

      if (options.argv.print) {
        console.log(repository);
      } else {
        this.openRepositoryUrl(repository);
      }
    }
  }
