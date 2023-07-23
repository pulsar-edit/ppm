
const path = require('path');
const _ = require('underscore-plus');
const yargs = require('yargs');
const apm = require('./apm');
const Command = require('./command');

module.exports =
class Config extends Command {
  static commandNames = [ "config" ];

  constructor() {
    super();
    const atomDirectory = apm.getAtomDirectory();
    this.atomNodeDirectory = path.join(atomDirectory, '.node-gyp');
    this.atomNpmPath = require.resolve('npm/bin/npm-cli');
  }

  parseOptions(argv) {
    const options = yargs(argv).wrap(Math.min(100, yargs.terminalWidth()));
    options.usage(`\

Usage: ppm config set <key> <value>
       ppm config get <key>
       ppm config delete <key>
       ppm config list
       ppm config edit
\
`
    );
    options.alias('h', 'help').describe('help', 'Print this usage message');
  }

  run(options) {
    const {callback} = options;
    options = this.parseOptions(options.commandArgs);

    let configArgs = ['--globalconfig', apm.getGlobalConfigPath(), '--userconfig', apm.getUserConfigPath(), 'config'];
    configArgs = configArgs.concat(options.argv._);

    const env = _.extend({}, process.env, {HOME: this.atomNodeDirectory, RUSTUP_HOME: apm.getRustupHomeDirPath()});
    const configOptions = {env};

    return this.fork(this.atomNpmPath, configArgs, configOptions, function(code, stderr, stdout) {
      if (stderr == null) { stderr = ''; }
      if (stdout == null) { stdout = ''; }
      if (code === 0) {
        if (stdout) { process.stdout.write(stdout); }
        return callback();
      } else {
        if (stderr) { process.stdout.write(stderr); }
        return callback(new Error(`npm config failed: ${code}`));
      }
    });
  }
}
