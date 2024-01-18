
const path = require('path');

const CSON = require('season');
const yargs = require('yargs');

const Command = require('./command');
const config = require('./apm');
const fs = require('./fs');

module.exports =
class Link extends Command {
  static commandNames = [ "link", "ln" ];

    parseOptions(argv) {
      const options = yargs(argv).wrap(Math.min(100, yargs.terminalWidth()));
      options.usage(`\

Usage: ppm link [<package_path>] [--name <package_name>]

Create a symlink for the package in ~/.pulsar/packages. The package in the
current working directory is linked if no path is given.

Run \`ppm links\` to view all the currently linked packages.\
`
      );
      options.alias('h', 'help').describe('help', 'Print this usage message');
      options.alias('f', 'force').boolean('force').describe('force', 'Remove the target path before linking');
      return options.alias('d', 'dev').boolean('dev').describe('dev', 'Link to ~/.pulsar/dev/packages');
    }

    async run(options) {
      options = this.parseOptions(options.commandArgs);

      const packagePath = options.argv._[0]?.toString() ?? ".";
      const linkPath = path.resolve(process.cwd(), packagePath);

      let packageName = options.argv.name;
      try {
        packageName ||= CSON.readFileSync(CSON.resolve(path.join(linkPath, 'package'))).name;
      } catch (error) {}
      packageName ||= path.basename(linkPath);

      const targetPath = options.argv.dev
        ? path.join(config.getAtomDirectory(), 'dev', 'packages', packageName)
        : path.join(config.getAtomDirectory(), 'packages', packageName);

      if (!fs.existsSync(linkPath)) {
        return `Package directory does not exist: ${linkPath}`; // error as value for now
      }

      try {
        if (fs.isSymbolicLinkSync(targetPath)) { fs.unlinkSync(targetPath); }
        else if (options.argv.force && fs.existsSync(targetPath)) {
            fs.rmSync(targetPath, { recursive: true, force: true });
        }
        fs.makeTreeSync(path.dirname(targetPath));
        fs.symlinkSync(linkPath, targetPath, 'junction');
        console.log(`${targetPath} -> ${linkPath}`);
      } catch (error) {
        return `Linking ${targetPath} to ${linkPath} failed: ${error.message}`; // error as value for now
      }
    }
  }
