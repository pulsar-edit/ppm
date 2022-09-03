/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__, or convert again using --optional-chaining
 * DS104: Avoid inline assignments
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
let name;
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

const setupTempDirectory = function() {
  const temp = require('temp');
  let tempDirectory = require('os').tmpdir();
  // Resolve ~ in tmp dir atom/atom#2271
  tempDirectory = path.resolve(fs.absolute(tempDirectory));
  temp.dir = tempDirectory;
  try {
    fs.makeTreeSync(temp.dir);
  } catch (error) {}
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
for (let commandClass of Array.from(commandClasses)) {
  for (name of Array.from(commandClass.commandNames != null ? commandClass.commandNames : [])) {
    commands[name] = commandClass;
  }
}

const parseOptions = function(args) {
  if (args == null) { args = []; }
  const options = yargs(args).wrap(Math.min(100, yargs.terminalWidth()));
  options.usage(`\

apm - Pulsar Package Manager powered by https://github.com/pulsar-edit

Usage: apm <command>

where <command> is one of:
${wordwrap(4, 80)(Object.keys(commands).sort().join(', '))}.

Run \`apm help <command>\` to see the more details about a specific command.\
`
  );
  options.alias('v', 'version').describe('version', 'Print the apm version');
  options.alias('h', 'help').describe('help', 'Print this usage message');
  options.boolean('color').default('color', true).describe('color', 'Enable colored output');
  options.command = options.argv._[0];
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === options.command) {
      options.commandArgs = args.slice(index+1);
      break;
    }
  }
  return options;
};

const showHelp = function(options) {
  if (options == null) { return; }

  let help = options.help();
  if (help.indexOf('Options:') >= 0) {
    help += "\n  Prefix an option with `no-` to set it to false such as --no-color to disable";
    help += "\n  colored output.";
  }

  return console.error(help);
};

const printVersions = function(args, callback) {
  let left, left1;
  const apmVersion =  (left = require('../package.json').version) != null ? left : '';
  const npmVersion = (left1 = require('npm/package.json').version) != null ? left1 : '';
  const nodeVersion = process.versions.node != null ? process.versions.node : '';

  return getPythonVersion(pythonVersion => git.getGitVersion(gitVersion => getAtomVersion(function(atomVersion) {
    let versions;
    if (args.json) {
      versions = {
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
      if (pythonVersion == null) { pythonVersion = ''; }
      if (gitVersion == null) { gitVersion = ''; }
      if (atomVersion == null) { atomVersion = ''; }
      versions =  `\
${'apm'.red}  ${apmVersion.red}
${'npm'.green}  ${npmVersion.green}
${'node'.blue} ${nodeVersion.blue} ${process.arch.blue}
${'atom'.cyan} ${atomVersion.cyan}
${'python'.yellow} ${pythonVersion.yellow}
${'git'.magenta} ${gitVersion.magenta}\
`;

      if (config.isWin32()) {
        let left2;
        const visualStudioVersion = (left2 = config.getInstalledVisualStudioFlag()) != null ? left2 : '';
        versions += `\n${'visual studio'.cyan} ${visualStudioVersion.cyan}`;
      }

      console.log(versions);
    }
    return callback();
  })));
};

var getAtomVersion = callback => config.getResourcePath(function(resourcePath) {
  const unknownVersion = 'unknown';
  try {
    let left;
    const {version} = (left = require(path.join(resourcePath, 'package.json'))) != null ? left : unknownVersion;
    return callback(version);
  } catch (error) {
    return callback(unknownVersion);
  }
});

var getPythonVersion = function(callback) {
  const npmOptions = {
    userconfig: config.getUserConfigPath(),
    globalconfig: config.getGlobalConfigPath()
  };
  return npm.load(npmOptions, function() {
    let left;
    let python = (left = npm.config.get('python')) != null ? left : process.env.PYTHON;
    if (config.isWin32() && !python) {
      let rootDir = process.env.SystemDrive != null ? process.env.SystemDrive : 'C:\\';
      if (rootDir[rootDir.length - 1] !== '\\') { rootDir += '\\'; }
      const pythonExe = path.resolve(rootDir, 'Python27', 'python.exe');
      if (fs.isFileSync(pythonExe)) { python = pythonExe; }
    }

    if (python == null) { python = 'python'; }

    const spawned = spawn(python, ['--version']);
    const outputChunks = [];
    spawned.stderr.on('data', chunk => outputChunks.push(chunk));
    spawned.stdout.on('data', chunk => outputChunks.push(chunk));
    spawned.on('error', function() {});
    return spawned.on('close', function(code) {
      let version;
      if (code === 0) {
        [name, version] = Array.from(Buffer.concat(outputChunks).toString().split(' '));
        version = version != null ? version.trim() : undefined;
      }
      return callback(version);
    });
  });
};

module.exports = {
  run(args, callback) {
    let Command;
    config.setupApmRcFile();
    const options = parseOptions(args);

    if (!options.argv.color) {
      colors.disable();
    }

    let callbackCalled = false;
    options.callback = function(error) {
      if (callbackCalled) { return; }
      callbackCalled = true;
      if (error != null) {
        let message;
        if (_.isString(error)) {
          message = error;
        } else {
          message = error.message != null ? error.message : error;
        }

        if (message === 'canceled') {
          // A prompt was canceled so just log an empty line
          console.log();
        } else if (message) {
          console.error(message.red);
        }
      }
      return (typeof callback === 'function' ? callback(error) : undefined);
    };

    args = options.argv;
    const {
      command
    } = options;
    if (args.version) {
      return printVersions(args, options.callback);
    } else if (args.help) {
      if ((Command = commands[options.command])) {
        showHelp(__guardMethod__(new Command(), 'parseOptions', o => o.parseOptions(options.command)));
      } else {
        showHelp(options);
      }
      return options.callback();
    } else if (command) {
      if (command === 'help') {
        if ((Command = commands[options.commandArgs])) {
          showHelp(__guardMethod__(new Command(), 'parseOptions', o1 => o1.parseOptions(options.commandArgs)));
        } else {
          showHelp(options);
        }
        return options.callback();
      } else if ((Command = commands[command])) {
        return new Command().run(options);
      } else {
        return options.callback(`Unrecognized command: ${command}`);
      }
    } else {
      showHelp(options);
      return options.callback();
    }
  }
};

function __guardMethod__(obj, methodName, transform) {
  if (typeof obj !== 'undefined' && obj !== null && typeof obj[methodName] === 'function') {
    return transform(obj, methodName);
  } else {
    return undefined;
  }
}
