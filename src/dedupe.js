const { performance } = require("node:perf_hooks");
const path = require('path');
const Arborist = require("@npmcli/arborist");
const yargs = require('yargs');
const config = require('./apm');
const Command = require('./command');
const fs = require('./fs');

module.exports =
class Dedupe extends Command {
  static commandNames = [ "dedupe" ];

    constructor() {
      super();
      this.atomDirectory = config.getAtomDirectory();
      this.atomNodeDirectory = path.join(this.atomDirectory, '.node-gyp');
    }

    parseOptions(argv) {
      const options = yargs(argv).wrap(Math.min(100, yargs.terminalWidth()));
      options.usage(`\

Usage: ppm dedupe

Reduce duplication in the node_modules folder in the current directory.

This command is experimental.\
`
      );
      return options.alias('h', 'help').describe('help', 'Print this usage message');
    }

    async dedupeModules(options) {
      process.stdout.write('Deduping modules ');

      // Process here is modeled after the NPM CLI v11.11.1
      // https://github.com/npm/cli/blob/v11.11.1/lib/commands/dedupe.js
      const started = performance.now();
      const arb = new Arborist({
        registry: process.env.npm_config_registry ?? "https://registry.npmjs.org",
        save: false
      });

      try {
        await arb.dedupe();
        this.logArboristResults(arb, started);
        this.logSuccess();
        return;
      } catch(err) {
        console.error(err);
        this.logFailure();
        throw err;
      }
    }

    createAtomDirectories() {
      fs.makeTreeSync(this.atomDirectory);
      fs.makeTreeSync(this.atomNodeDirectory);
    }

    async run(options) {
      const {cwd} = options;
      options = this.parseOptions(options.commandArgs);
      options.cwd = cwd;

      this.createAtomDirectories();

      try {
        await this.loadInstalledAtomMetadata();
        await this.dedupeModules(options);
      } catch(err) {
        return err;
      }
    }
}
