/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
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
(Clean = (function() {
  Clean = class Clean extends Command {
    static initClass() {
      this.commandNames = ['clean', 'prune'];
    }

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
  Clean.initClass();
  return Clean;
})());
