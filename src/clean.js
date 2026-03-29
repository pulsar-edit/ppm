const { performance } = require("node:perf_hooks");
const yargs = require('yargs');
const Arborist = require("@npmcli/arborist");
const Command = require('./command');

module.exports =
class Clean extends Command {
  static commandNames = ["clean", "prune"];

  constructor() {
    super();
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
    process.stdout.write("Removing extraneous modules\n");

    // Process here is modeled after the NPM CLI v11.11.1
    // https://github.com/npm/cli/blob/v11.11.1/lib/commands/prune.js
    const started = performance.now();
    const arb = new Arborist({
      registry: process.env.npm_config_registry ?? "https://registry.npmjs.org"
    });
    return new Promise(async (resolve, reject) => {
      try {
        await arb.prune();
        this.logArboristResults(arb, started);
        this.logSuccess();
        resolve();
      } catch(err) {
        console.error(err);
        this.logFailure();
        reject(err);
      }
    });
  }
};
