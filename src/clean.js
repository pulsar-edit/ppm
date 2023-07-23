
let Clean;
const path = require('path');

const async = require('async');
const CSON = require('season');
const yargs = require('yargs');
const _ = require('underscore-plus');

const Command = require('./command');
const config = require('./apm');
const fs = require('./fs');

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

  run(options) {
    process.stdout.write("Removing extraneous modules ");
    return this.fork(this.atomNpmPath, ['prune'], (...args) => {
      return this.logCommandResults(options.callback, ...args);
    });
  }
};
