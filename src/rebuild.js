const { performance } = require("node:perf_hooks");
const path = require('path');
const Arborist = require("@npmcli/arborist");
const yargs = require('yargs');
const semver = require("semver");
const npa = require("npm-package-arg");
const config = require('./apm');
const Command = require('./command');
const fs = require('./fs');

module.exports =
class Rebuild extends Command {
  static commandNames = [ "rebuild" ];

    constructor() {
      super();
    }

    parseOptions(argv) {
      const options = yargs(argv).wrap(Math.min(100, yargs.terminalWidth()));
      options.usage(`\

Usage: ppm rebuild [<name> [<name> ...]]

Rebuild the given modules currently installed in the node_modules folder
in the current working directory.

All the modules will be rebuilt if no module names are specified.\
`
      );
      return options.alias('h', 'help').describe('help', 'Print this usage message');
    }

    async forkNpmRebuild(options) {
      process.stdout.write('Rebuilding modules\n');

      // Process here is modeled after the NPM CLI v11.11.1
      // https://github.com/npm/cli/blob/v11.11.1/lib/commands/rebuild.js
      fs.makeTreeSync(config.getAtomDirectory());

      const started = performance.now();
      const arb = new Arborist({
        ...config.getArboristConfig(),
        legacyPeerDeps: true
      });

      if (options.argv._.length > 0) {
        // get the set of nodes matching the name that we want rebuilt
        const tree = await arb.loadActual();
        const specs = options.argv._.map(arg => {
          const spec = npa(arg);

          if (spec.rawSpec === "*") {
            return spec;
          }

          if (spec.type !== "range" && spec.type !== "version" && spec.type !== "directory") {
            throw new Error("`ppm rebuild` only supports SemVer version/range specifiers");
          }

          return spec;
        });

        const nodes = tree.inventory.filter(node => this.isNode(specs, node));

        await arb.rebuild({ nodes });
      } else {
        await arb.rebuild();
      }

      this.logArboristResults(arb, started);
    }

    isNode(specs, node) {
      return specs.some(spec => {
        if (spec.type === "directory") {
          return node.path === spec.fetchSpec;
        }

        if (spec.name !== node.name) {
          return false;
        }

        if (spec.rawSpec === "" || spec.rawSpec === "*") {
          return true;
        }

        const { version } = node.package;
        return semver.satisfies(version, spec.fetchSpec);
      });
    }

    async run(options) {
      options = this.parseOptions(options.commandArgs);

      try {
        await this.loadInstalledAtomMetadata();
        await this.forkNpmRebuild(options);
        this.logSuccess();
      } catch (error) {
        this.logFailure();
        return error; // errors as return values atm
      }
    }
  }
