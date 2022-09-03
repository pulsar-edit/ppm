/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS104: Avoid inline assignments
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
let Link;
const path = require('path');

const CSON = require('season');
const yargs = require('yargs');

const Command = require('./command');
const config = require('./apm');
const fs = require('./fs');

module.exports =
(Link = (function() {
  Link = class Link extends Command {
    static initClass() {
      this.commandNames = ['link', 'ln'];
    }

    parseOptions(argv) {
      const options = yargs(argv).wrap(Math.min(100, yargs.terminalWidth()));
      options.usage(`\

Usage: apm link [<package_path>] [--name <package_name>]

Create a symlink for the package in ~/.atom/packages. The package in the
current working directory is linked if no path is given.

Run \`apm links\` to view all the currently linked packages.\
`
      );
      options.alias('h', 'help').describe('help', 'Print this usage message');
      return options.alias('d', 'dev').boolean('dev').describe('dev', 'Link to ~/.atom/dev/packages');
    }

    run(options) {
      let left, targetPath;
      const {callback} = options;
      options = this.parseOptions(options.commandArgs);

      const packagePath = (left = (options.argv._[0] != null ? options.argv._[0].toString() : undefined)) != null ? left : '.';
      const linkPath = path.resolve(process.cwd(), packagePath);

      let packageName = options.argv.name;
      try {
        if (!packageName) { packageName = CSON.readFileSync(CSON.resolve(path.join(linkPath, 'package'))).name; }
      } catch (error1) {}
      if (!packageName) { packageName = path.basename(linkPath); }

      if (options.argv.dev) {
        targetPath = path.join(config.getAtomDirectory(), 'dev', 'packages', packageName);
      } else {
        targetPath = path.join(config.getAtomDirectory(), 'packages', packageName);
      }

      if (!fs.existsSync(linkPath)) {
        callback(`Package directory does not exist: ${linkPath}`);
        return;
      }

      try {
        if (fs.isSymbolicLinkSync(targetPath)) { fs.unlinkSync(targetPath); }
        fs.makeTreeSync(path.dirname(targetPath));
        fs.symlinkSync(linkPath, targetPath, 'junction');
        console.log(`${targetPath} -> ${linkPath}`);
        return callback();
      } catch (error) {
        return callback(`Linking ${targetPath} to ${linkPath} failed: ${error.message}`);
      }
    }
  };
  Link.initClass();
  return Link;
})());
