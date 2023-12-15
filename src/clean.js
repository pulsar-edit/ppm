
const yargs = require('yargs');

const Command = require('./command');
const config = require('./apm');

module.exports =
class Clean extends Command {
  static commandNames = ["clean", "prune"];

  constructor() {
    super();
    this.atomNpmPath = require.resolve('npm/bin/npm-cli');
  }

  parseOptions(argv) {
    const options = yargs(argv).wrap(Math.min(100, yargs.terminalWidth()));

    options.usage(`\
Usage: ppm clean

Deletes all packages in the node_modules folder that are not referenced
as a dependency in the package.json file.\
`
    );
    return options.alias('h', 'help').describe('help', 'Print this usage message');
  }

  run(_options) {
    process.stdout.write("Removing extraneous modules ");
    return new Promise((resolve, reject) =>
      void this.fork(this.atomNpmPath, ['prune'], (...args) =>
        void this.logCommandResults(...args).then(resolve, reject)
      )
    );
  }
};
