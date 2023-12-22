const {spawn} = require('child_process');
const path = require('path');

const _ = require('underscore-plus');
const colors = require('colors');
const npm = require('npm');
const yargs = require('yargs');
const wordwrap = require('wordwrap');

// Enable "require" scripts in asar archives
require('asar-require');

const config = require('./apm.js');
const fs = require('./fs.js');
const git = require('./git.js');

function setupTempDirectory() {
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
  require('./ci.js'),
  require('./clean.js'),
  require('./config.js'),
  require('./dedupe.js'),
  require('./develop.js'),
  require('./disable.js'),
  require('./docs.js'),
  require('./enable.js'),
  require('./featured.js'),
  require('./init.js'),
  require('./install.js'),
  require('./links.js'),
  require('./link.js'),
  require('./list.js'),
  require('./login.js'),
  require('./publish.js'),
  require('./rebuild.js'),
  require('./rebuild-module-cache.js'),
  require('./search.js'),
  require('./star.js'),
  require('./stars.js'),
  require('./test.js'),
  require('./uninstall.js'),
  require('./unlink.js'),
  require('./unpublish.js'),
  require('./unstar.js'),
  require('./upgrade.js'),
  require('./view.js')
];

const commands = {};
for (let commandClass of commandClasses) {
  for (let name of commandClass.commandNames ?? []) {
    commands[name] = commandClass;
  }
}

function parseOptions(args) {
  args ??= [];
  const options = yargs(args).wrap(Math.min(100, yargs.terminalWidth()));
  options.usage(`\

Pulsar Package Manager powered by https://pulsar-edit.dev

  Usage: pulsar --package <command>

  where <command> is one of:
  ${wordwrap(4, 80)(Object.keys(commands).sort().join(', '))}.

  Run \`pulsar --package help <command>\` to see the more details about a specific command.\
`
  );
  options.alias('v', 'version').describe('version', 'Print the ppm version');
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

function showHelp(options) {
  if (options == null) { return; }

  let help = options.help();
  if (help.indexOf('Options:') >= 0) {
    help += "\n  Prefix an option with `no-` to set it to false such as --no-color to disable";
    help += "\n  colored output.";
  }

  console.error(help);
};

async function printVersions(args) {
    const apmVersion = require("../package.json").version ?? "";
    const npmVersion = require("npm/package.json").version ?? "";
    const nodeVersion = process.versions.node ?? "";

    let pythonVersion = await getPythonVersion();
    let gitVersion = await git.getGitVersion();
    let atomVersion = await getAtomVersion();
    let versions;
    if (args.json) {
      versions = {
        apm: apmVersion,
        ppm: apmVersion,
        npm: npmVersion,
        node: nodeVersion,
        atom: atomVersion,
        pulsar: atomVersion,
        python: pythonVersion,
        git: gitVersion,
        nodeArch: process.arch
      };
      if (config.isWin32()) {
        versions.visualStudio = config.getInstalledVisualStudioFlag();
      }
      console.log(JSON.stringify(versions));
      return;
    }

    pythonVersion ??= '';
    gitVersion ??= '';
    atomVersion ??= '';
    versions =  `\
${'ppm'.red}  ${apmVersion.red}
${'npm'.green}  ${npmVersion.green}
${'node'.blue} ${nodeVersion.blue} ${process.arch.blue}
${'pulsar'.cyan} ${atomVersion.cyan}
${'python'.yellow} ${pythonVersion.yellow}
${'git'.magenta} ${gitVersion.magenta}\
`;

    if (config.isWin32()) {
      const visualStudioVersion = config.getInstalledVisualStudioFlag() ?? "";
      versions += `\n${'visual studio'.cyan} ${visualStudioVersion.cyan}`;
    }

    console.log(versions);
};

async function getAtomVersion() {
  const resourcePath = await config.getResourcePath();
  const unknownVersion = 'unknown';
  try {
    const { version } = require(path.join(resourcePath, "package.json")) ?? unknownVersion;
    return version;
  } catch (error) {
    return unknownVersion;
  }
}

function getPythonVersion() {
  return new Promise((resolve, _reject) => {
    const npmOptions = {
      userconfig: config.getUserConfigPath(),
      globalconfig: config.getGlobalConfigPath()
    };
    npm.load(npmOptions, () => {
      let python = npm.config.get("python") ?? process.env.PYTHON;
      if (config.isWin32() && !python) {
        let rootDir = process.env.SystemDrive ??= 'C:\\';
        if (rootDir[rootDir.length - 1] !== '\\') { rootDir += '\\'; }
        const pythonExe = path.resolve(rootDir, 'Python27', 'python.exe');
        if (fs.isFileSync(pythonExe)) { python = pythonExe; }
      }

      python ??= 'python';

      const spawned = spawn(python, ['--version']);
      const outputChunks = [];
      spawned.stderr.on('data', chunk => outputChunks.push(chunk));
      spawned.stdout.on('data', chunk => outputChunks.push(chunk));
      spawned.on('error', () => {});
      return spawned.on('close', code => {
        let version, name;
        if (code === 0) {
          [name, version] = Buffer.concat(outputChunks).toString().split(' ');
          version = version?.trim();
        }
        return resolve(version);
      });
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
    const errorHandler = error => {
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
      return callback?.(error);
    };

    args = options.argv;
    const {
      command
    } = options;
    if (args.version) {
      return printVersions(args).then(errorHandler);
    } else if (args.help) {
      if (commands[options.command]) {
        Command = commands[options.command];
        showHelp(new Command().parseOptions?.(options.command));
      } else {
        showHelp(options);
      }
      return errorHandler();
    } else if (command) {
      if (command === 'help') {
        if (commands[options.commandArgs]) {
          Command = commands[options.commandArgs];
          showHelp(new Command().parseOptions?.(options.commandArgs));
        } else {
          showHelp(options);
        }
        return errorHandler();
      } else if ((Command = commands[command])) {
        //Command = commands[command];
        const command = new Command();
        return command.run(options).then(errorHandler);
      } else {
        return errorHandler(`Unrecognized command: ${command}`);
      }
    } else {
      showHelp(options);
      return errorHandler();
    }
  }
};
