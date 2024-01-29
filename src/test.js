
const path = require('path');

const yargs = require('yargs');
const temp = require('temp');

const Command = require('./command');
const fs = require('./fs');

module.exports =
class Test extends Command {
  static commandNames = [ "test" ];

    parseOptions(argv) {
      const options = yargs(argv).wrap(Math.min(100, yargs.terminalWidth()));

      options.usage(`\
Usage:
  ppm test

Runs the package's tests contained within the spec directory (relative
to the current working directory).\
`
      );
      options.alias('h', 'help').describe('help', 'Print this usage message');
      return options.alias('p', 'path').string('path').describe('path', 'Path to atom command');
    }

    run(options) {
      let atomCommand;
      options = this.parseOptions(options.commandArgs);
      const {env} = process;

      if (options.argv.path) { atomCommand = options.argv.path; }
      if (!fs.existsSync(atomCommand)) {
        atomCommand = 'pulsar';
        if (process.platform === 'win32') { atomCommand += '.cmd'; }
      }

      const packagePath = process.cwd();
      const testArgs = ['--dev', '--test', path.join(packagePath, 'spec')];

      return new Promise((resolve, _reject) => {
        if (process.platform === 'win32') {
          const logFile = temp.openSync({suffix: '.log', prefix: `${path.basename(packagePath)}-`});
          fs.closeSync(logFile.fd);
          const logFilePath = logFile.path;
          testArgs.push(`--log-file=${logFilePath}`);
  
          this.spawn(atomCommand, testArgs, code => {
            try {
              const loggedOutput = fs.readFileSync(logFilePath, 'utf8');
              if (loggedOutput) { process.stdout.write(`${loggedOutput}\n`); }
            } catch (error) {}
  
            if (code === 0) {
              process.stdout.write('Tests passed\n'.green);
              return void resolve();
            }
            if (code?.message) {
              return void resolve(`Error spawning Atom: ${code.message}`); // errors as return value atm
            }
  
            resolve('Tests failed'); // errors as return value atm
          });
        } else {
          this.spawn(atomCommand, testArgs, {env, streaming: true}, code => {
            if (code === 0) {
              process.stdout.write('Tests passed\n'.green);
              return void resolve();
            }
            if (code?.message) {
              return void resolve(`Error spawning ${atomCommand}: ${code.message}`); // errors as return value
            }

            resolve('Tests failed'); // errors as return value
          });
        }
      });
    }
  }
