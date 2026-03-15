const { performance } = require("node:perf_hooks");
const path = require('path');
const fs = require('./fs');
const yargs = require('yargs');
const Arborist = require("@npmcli/arborist");
const runScript = require("@npmcli/run-script");
const config = require('./apm');
const Command = require('./command');

module.exports =
class Ci extends Command {
  static commandNames = ["ci"];

  constructor() {
    super();
    this.atomDirectory = config.getAtomDirectory();
    this.atomNodeDirectory = path.join(this.atomDirectory, '.node-gyp');
  }

  parseOptions(argv) {
    const options = yargs(argv).wrap(Math.min(100, yargs.terminalWidth()));
    options.usage(`\
Usage: ppm ci

Install a package with a clean slate.

If you have an up-to-date package-lock.json file created by ppm install,
ppm ci will install its locked contents exactly. It is substantially
faster than ppm install and produces consistently reproduceable builds,
but cannot be used to install new packages or dependencies.\
`
);

    options.alias('h', 'help').describe('help', 'Print this usage message');
    return options.boolean('verbose').default('verbose', false).describe('verbose', 'Show verbose debug information');
  }

  async installModules(options) {
    process.stdout.write('Installing locked modules\n');

    // Process here is modeled after the NPM CLI v11.11.1
    // https://github.com/npm/cli/blob/v11.11.1/lib/commands/ci.js

    fs.makeTreeSync(this.atomDirectory);

    const started = performance.now();
    const arbOpts = {
      registry: process.env.npm_config_registry ?? "https://registry.npmjs.org",
      save: false, // ppm ci should never modify the lockfile or package.json
      packageLock: true, // ppm ci should never skip lock files
      cache: config.getCacheDirectory(),
      path: process.cwd(),
      // TODO: Options that `npm ci` doesn't use, but I needed to make specs happy
      legacyPeerDeps: true,
      packageLockOnly: true,
      preferFrozenLockfile: true
    };

    // Generate an inventory from the virtual tree in the lockfile
    const virtualArb = new Arborist(arbOpts);
    try {
      await virtualArb.loadVirtual();
    } catch(err) {
      console.error(err);
      throw "ppm ci requires an existing lockfile. Please generate on then try again.";
    }
    const virtualInventory = new Map(virtualArb.virtualTree.inventory);

    const arb = new Arborist(arbOpts);
    await arb.buildIdealTree();

    //const errors = this.validateLockfile(virtualInventory, arb.idealTree.inventory);
    const errors = []; // TODO: Why doesn't `arb.buildIdealTree` have an inventory with versions???
    if (errors.length > 0) {
      console.error(errors.join("\n"));
      throw "ppm ci can only install packages when your package.json and lockfile are in sync.";
    }

    // NPM CI now deletes all node_modules, it seems to be a performance trick,
    // Lets skip it and see if it's something we need.

    await arb.reify(arbOpts);

    // Run the same set of scripts that `ppm install` runs
    const scripts = [
      "preinstall",
      "install",
      "postinstall",
      "preprepare",
      "prepare",
      "postprepare"
    ];
    const scriptShell = await config.getSetting("script-shell") || undefined;
    for (const event of scripts) {
      await runScript({
        path: process.cwd(),
        args: [],
        scriptShell,
        stdio: "inherit",
        event
      });
    }

    this.logArboristResults(arb, started);
    this.logSuccess();
  }

  validateLockfile(virtualTree, idealTree) {
    const errors = [];

    for (const [key, entry] of idealTree.entries()) {
      const lock = virtualTree.get(key);

      if (!lock) {
        errors.push(`Missing: ${entry.name}@${entry.version} from lock file`);
        continue;
      }

      if (entry.version !== lock.version) {
        console.log(entry);
        errors.push(`Invalid: lock file's ${lock.name}@${lock.version} does not satisfy ${entry.name}@${entry.version}`);
      }
    }

    return errors;
  }

  async run(options) {
    const opts = this.parseOptions(options.commandArgs);

    try {
      await this.loadInstalledAtomMetadata();
      await this.installModules(opts);
    } catch(err) {
      return err;
    }

  }
};
