const {spawn} = require('child_process');
const path = require('path');
const _ = require('underscore-plus');
const colors = require('colors');
const npm = require('npm');
const yargs = require('yargs');
const wordwrap = require('wordwrap');
// Enable "require" scripts in asar archives
require('asar-require');
const config = require('./apm');
const fs = require('./fs');
const git = require('./git');

function setupTempDirectory() {
  const temp = require('temp');
  // Resolve ~ in tmp dir atom/atom#2271
  let tempDirectory = require('os').tmpdir();
  temp.dir = path.resolve(fs.absolute(tempDirectory));
  try {
    fs.makeTreeSync(temp.dir);
  } catch (e) {}
  return temp.track();
};

setupTempDirectory();

const commandClasses = [
  require('./ci'),
  require('./clean'),
  require('./config'),
  require('./dedupe'),
  require('./develop'),
  require('./disable'),
  require('./docs'),
  require('./enable'),
  require('./featured'),
  require('./init'),
  require('./install'),
  require('./links'),
  require('./link'),
  require('./list'),
  require('./login'),
  require('./publish'),
  require('./rebuild'),
  require('./rebuild-module-cache'),
  require('./search'),
  require('./star'),
  require('./stars'),
  require('./test'),
  require('./uninstall'),
  require('./unlink'),
  require('./unpublish'),
  require('./unstar'),
  require('./upgrade'),
  require('./view')
];

const commands = {};

for (const commandClass of commandClasses) {
  for (const name of commandClass.commandNames || []) {
    commands[name] = commandClass;
  }
}

function parseOptions(args) {
  if (!args) args = [];
  const options = yargs(args).wrap(Math.min(100, yargs.terminalWidth()));
  options.usage("\nPulsar Package Manager powered by https://pulsar-edit.com\n\n  Usage: apm <command>\n\n  where <command> is one of:\n  " + (wordwrap(4, 80)(Object.keys(commands).sort().join(', '))) + ".\n\n  Run `apm help <command>` to see the more details about a specific command.");
  options.alias('v', 'version').describe('version', 'Print the apm version');
  options.alias('h', 'help').describe('help', 'Print this usage message');
  options.boolean('color')["default"]('color', true).describe('color', 'Enable colored output');
  options.command = options.argv._[0];
  for (let i = 0; i < args.length; i++) {
    if (args[i] !== options.command) continue;
    options.commandArgs = args.slice(i + 1);
    break;
  }
  return options;
};

function showHelp(options) {
  if (!options) return;
  let help = options.help();
  if (help.indexOf('Options:') >= 0) {
    help += "\n  Prefix an option with `no-` to set it to false such as --no-color to disable";
    help += "\n  colored output.";
  }
  console.error(help);
};

function printVersions(args, callback) {
  const apmVersion = require('../package.json').version || '';
  const npmVersion = require('npm/package.json').version || '';
  const nodeVersion = process.versions.node || '';
  getPythonVersion( pythonVersion =>
    git.getGitVersion( gitVersion =>
      getAtomVersion( atomVersion => {
        if (args.json) {
          const versions = {
            apm: apmVersion,
            npm: npmVersion,
            node: nodeVersion,
            atom: atomVersion,
            python: pythonVersion,
            git: gitVersion,
            nodeArch: process.arch
          };
          if (config.isWin32()) {
            versions.visualStudio = config.getInstalledVisualStudioFlag();
          }
          console.log(JSON.stringify(versions));
        } else {
          const versions = [
            `apm  ${apmVersion}`.red,
            `npm  ${npmVersion}`.green,
            `node ${nodeVersion} ${process.arch}`.blue,
            `atom ${atomVersion || ''}`.cyan,
            `python ${pythonVersion || ''}`.yellow,
            `git ${gitVersion || ''}`.magenta
          ];
          if (config.isWin32()) {
            const visualStudioVersion = config.getInstalledVisualStudioFlag() || '';
            versions.push(`visual studio ${visualStudioVersion}`.cyan);
          }
          console.log(versions.join("\n"));
        }
        callback();
      })
    )
  );
};

function getAtomVersion(callback) {
  config.getResourcePath( resourcePath => {
    const unknownVersion = 'unknown';
    try {
      const version = require(path.join(resourcePath, 'package.json')).version || unknownVersion;
      callback(version);
    } catch (e) {
      callback(unknownVersion);
    }
  });
};

function getPythonVersion(callback) {
  const npmOptions = {
    userconfig: config.getUserConfigPath(),
    globalconfig: config.getGlobalConfigPath()
  };
  npm.load(npmOptions, () => {
    let python = npm.config.get('python') || process.env.PYTHON;
    if (config.isWin32() && !python) {
      let rootDir = process.env.SystemDrive || 'C:\\';
      if (rootDir[rootDir.length - 1] !== '\\') {
        rootDir += '\\';
      }
      const pythonExe = path.resolve(rootDir, 'Python27', 'python.exe');
      if (fs.isFileSync(pythonExe)) {
        python = pythonExe;
      }
    }
    if (!python) python = 'python';
    const spawned = spawn(python, ['--version']);
    const outputChunks = [];
    spawned.stderr.on('data', chunk =>
      outputChunks.push(chunk)
    );
    spawned.stdout.on('data', chunk =>
      outputChunks.push(chunk)
    );
    spawned.on('error', () => {});
    spawned.on('close', code => {
      let version;
      if (code === 0) {
        version = Buffer.concat(outputChunks).toString().split(' ')[1]?.trim();
      }
      callback(version);
    });
  });
};

module.exports = {
  run(rawArgs, callback) {
    config.setupApmRcFile();
    const options = parseOptions(rawArgs);
    if (!options.argv.color) {
      colors.disable();
    }
    let callbackCalled = false;
    options.callback = error => {
      if (callbackCalled) return;
      callbackCalled = true;
      if (error != null) {
        let message;
        if (_.isString(error)) {
          message = error;
        } else {
          message = error.message || error;
        }
        if (message === 'canceled') {
          // A prompt was canceled so just log an empty line
          console.log();
        } else if (message) {
          console.error(message.red);
        }
      }
      callback?.(error);
    };
    const args = options.argv;
    const command = options.command;
    if (args.version) {
      printVersions(args, options.callback);
    } else if (args.help) {
      const Command = commands[options.command];
      if (Command) {
        showHelp(new Command().parseOptions?.(options.command));
      } else {
        showHelp(options);
      }
      options.callback();
    } else if (command) {
      if (command === 'help') {
        const Command = commands[options.commandArgs];
        if (Command) {
          showHelp(new Command().parseOptions?.(options.commandArgs));
        } else {
          showHelp(options);
        }
        options.callback();
      } else {
        const Command = commands[command];
        if (Command) {
          new Command().run(options);
        } else {
          options.callback("Unrecognized command: " + command);
        }
      }
    } else {
      showHelp(options);
      options.callback();
    }
  }
};
