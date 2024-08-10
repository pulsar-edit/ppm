
const path = require('path');
const fs = require('./fs');
const yargs = require('yargs');
const _ = require('underscore-plus');

const config = require('./apm');
const Command = require('./command');

module.exports =
class Ci extends Command {
  static commandNames = ["ci"];

  constructor() {
    super();
    this.atomDirectory = config.getAtomDirectory();
    this.atomNodeDirectory = path.join(this.atomDirectory, '.node-gyp');
    this.atomNpmPath = require.resolve('npm/bin/npm-cli');
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

  installModules(options) {
    process.stdout.write('Installing locked modules');
    if (options.argv.verbose) {
      process.stdout.write('\n');
    } else {
      process.stdout.write(' ');
    }

    const installArgs = [
      'ci',
      '--globalconfig', config.getGlobalConfigPath(),
      '--userconfig', config.getUserConfigPath(),
      ...this.getNpmBuildFlags()
    ];
    if (options.argv.verbose) { installArgs.push('--verbose'); }

    fs.makeTreeSync(this.atomDirectory);

    const env = _.extend({}, process.env, {HOME: this.atomNodeDirectory, RUSTUP_HOME: config.getRustupHomeDirPath()});
    this.addBuildEnvVars(env);

    const installOptions = {env, streaming: options.argv.verbose};

    return new Promise((resolve, reject) =>
      void this.fork(this.atomNpmPath, installArgs, installOptions, (...args) =>
        void this.logCommandResults(...args).then(resolve, reject)
      )
    )
  }

  async run(options) {
    const opts = this.parseOptions(options.commandArgs);

    try {
      this.npm = await config.loadNpm();
      await this.loadInstalledAtomMetadata();
      await this.installModules(opts);
    } catch(err) {
      return err;
    }

  }
};
