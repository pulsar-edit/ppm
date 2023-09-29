
const assert = require('assert');
const path = require('path');

const _ = require('underscore-plus');
const async = require('async');
const CSON = require('season');
const yargs = require('yargs');
const Git = require('git-utils');
const semver = require('semver');
const temp = require('temp');
const hostedGitInfo = require('hosted-git-info');

const config = require('./apm');
const Command = require('./command');
const fs = require('./fs');
const RebuildModuleCache = require('./rebuild-module-cache');
const request = require('./request');
const {isDeprecatedPackage} = require('./deprecated-packages');

module.exports =
class Install extends Command {
  static promiseBased = true;
  static commandNames = [ "install", "i" ];

    constructor() {
      super();
      this.installModules = this.installModules.bind(this);
      this.installGitPackageDependencies = this.installGitPackageDependencies.bind(this);
      this.atomDirectory = config.getAtomDirectory();
      this.atomPackagesDirectory = path.join(this.atomDirectory, 'packages');
      this.atomNodeDirectory = path.join(this.atomDirectory, '.node-gyp');
      this.atomNpmPath = require.resolve('npm/bin/npm-cli');
      this.repoLocalPackagePathRegex = /^file:(?!\/\/)(.*)/;
    }

    parseOptions(argv) {
      const options = yargs(argv).wrap(Math.min(100, yargs.terminalWidth()));
      options.usage(`\

Usage: ppm install [<package_name>...]
       ppm install <package_name>@<package_version>
       ppm install <git_remote> [-b <branch_or_tag_or_commit>]
       ppm install <github_username>/<github_project> [-b <branch_or_tag_or_commit>]
       ppm install --packages-file my-packages.txt
       ppm i (with any of the previous argument usage)

Install the given Pulsar package to ~/.pulsar/packages/<package_name>.

If no package name is given then all the dependencies in the package.json
file are installed to the node_modules folder in the current working
directory.

A packages file can be specified that is a newline separated list of
package names to install with optional versions using the
\`package-name@version\` syntax.\
`
      );
      options.alias('c', 'compatible').string('compatible').describe('compatible', 'Only install packages/themes compatible with this Pulsar version');
      options.alias('h', 'help').describe('help', 'Print this usage message');
      options.alias('s', 'silent').boolean('silent').describe('silent', 'Set the npm log level to silent');
      options.alias('b', 'branch').string('branch').describe('branch', 'Sets the tag or branch to install');
      options.alias('t', 'tag').string('tag').describe('tag', 'Sets the tag or branch to install');
      options.alias('q', 'quiet').boolean('quiet').describe('quiet', 'Set the npm log level to warn');
      options.boolean('check').describe('check', 'Check that native build tools are installed');
      options.boolean('verbose').default('verbose', false).describe('verbose', 'Show verbose debug information');
      options.string('packages-file').describe('packages-file', 'A text file containing the packages to install');
      return options.boolean('production').describe('production', 'Do not install dev dependencies');
    }

    installModule(options, pack, moduleURI) {
      let installDirectory, nodeModulesDirectory;
      const installGlobally = options.installGlobally ?? true;

      const installArgs = ['--globalconfig', config.getGlobalConfigPath(), '--userconfig', config.getUserConfigPath(), 'install'];
      installArgs.push(moduleURI);
      installArgs.push(...this.getNpmBuildFlags());
      if (installGlobally) { installArgs.push("--global-style"); }
      if (options.argv.silent) { installArgs.push('--silent'); }
      if (options.argv.quiet) { installArgs.push('--quiet'); }
      if (options.argv.production) { installArgs.push('--production'); }
      if (options.argv.verbose) { installArgs.push('--verbose'); }

      fs.makeTreeSync(this.atomDirectory);

      const env = _.extend({}, process.env, {HOME: this.atomNodeDirectory, RUSTUP_HOME: config.getRustupHomeDirPath()});
      this.addBuildEnvVars(env);

      const installOptions = {env};
      if (this.verbose) { installOptions.streaming = true; }

      if (installGlobally) {
        installDirectory = temp.mkdirSync('apm-install-dir-');
        nodeModulesDirectory = path.join(installDirectory, 'node_modules');
        fs.makeTreeSync(nodeModulesDirectory);
        installOptions.cwd = installDirectory;
      }

      return new Promise((resolve, reject) => {
        this.fork(this.atomNpmPath, installArgs, installOptions, (code, stderr, stdout) => {
          stderr ??= '';
          stdout ??= '';
          if (code !== 0) {
            if (installGlobally) {
              fs.removeSync(installDirectory);
              this.logFailure();
            }

            let error = `${stdout}\n${stderr}`;
            if (error.indexOf('code ENOGIT') !== -1) { error = this.getGitErrorMessage(pack); }
            return void reject(error);
          }

          if (!installGlobally) {
              return void resolve({name: undefined, installPath: undefined});
          }

          const commands = [];
          const children = fs.readdirSync(nodeModulesDirectory)
            .filter(dir => dir !== ".bin");
          assert.equal(children.length, 1, "Expected there to only be one child in node_modules");
          const child = children[0];
          const source = path.join(nodeModulesDirectory, child);
          const destination = path.join(this.atomPackagesDirectory, child);
          commands.push(next => fs.cp(source, destination).then(next, next));
          commands.push(next => this.buildModuleCache(pack.name).then(next, next));
          commands.push(next => this.warmCompileCache(pack.name).then(next, next));

          async.waterfall(commands).then(() => {
            if (!options.argv.json) { this.logSuccess(); }
            resolve({name: child, installPath: destination});
          }, error => {
            this.logFailure();
            reject(error);
          });
        });
      });
    }

    getGitErrorMessage(pack) {
      let message = `\
Failed to install ${pack.name} because Git was not found.

The ${pack.name} package has module dependencies that cannot be installed without Git.

You need to install Git and add it to your path environment variable in order to install this package.
\
`;

      switch (process.platform) {
        case 'win32':
          message += `\

You can install Git by downloading, installing, and launching GitHub for Windows: https://windows.github.com
\
`;
          break;
        case 'linux':
          message += `\

You can install Git from your OS package manager.
\
`;
          break;
      }

      message += `\

Run ppm -v after installing Git to see what version has been detected.\
`;

      return message;
    }

    installModules(options) {
      if (!options.argv.json) { process.stdout.write('Installing modules '); }

      return new Promise((resolve, reject) => {
        this.forkInstallCommand(options, (...args) => {
          if (options.argv.json) {
            return void this.logCommandResultsIfFail(...args).then(resolve, reject);
          }

          return this.logCommandResults(...args).then(resolve, reject);
        });
      });
    }

    forkInstallCommand(options, callback) {
      const installArgs = ['--globalconfig', config.getGlobalConfigPath(), '--userconfig', config.getUserConfigPath(), 'install'];
      installArgs.push(...this.getNpmBuildFlags());
      if (options.argv.silent) { installArgs.push('--silent'); }
      if (options.argv.quiet) { installArgs.push('--quiet'); }
      if (options.argv.production) { installArgs.push('--production'); }

      fs.makeTreeSync(this.atomDirectory);

      const env = _.extend({}, process.env, {HOME: this.atomNodeDirectory, RUSTUP_HOME: config.getRustupHomeDirPath()});
      this.addBuildEnvVars(env);

      const installOptions = {env};
      if (options.cwd) { installOptions.cwd = options.cwd; }
      if (this.verbose) { installOptions.streaming = true; }

      return this.fork(this.atomNpmPath, installArgs, installOptions, callback);
    }

    // Request package information from the package API for a given package name.
    //
    // packageName - The string name of the package to request.
    //
    // return value - A Promise that rejects with an appropriate error or resolves to the response body
    requestPackage(packageName) {
      const requestSettings = {
        url: `${config.getAtomPackagesUrl()}/${packageName}`,
        json: true,
        retries: 4
      };
      return new Promise((resolve, reject) => {
        request.get(requestSettings, (error, response, body) => {
          let message;
          body ??= {};
          if (error != null) {
            message = `Request for package information failed: ${error.message}`;
            if (error.status) { message += ` (${error.status})`; }
            return void reject(message);
          }
          if (response.statusCode !== 200) {
            message = request.getErrorMessage(body, error);
            return void reject(`Request for package information failed: ${message}`);
          }
          if (!body.releases.latest) {
            return void reject(`No releases available for ${packageName}`);
          }

          resolve(body);
        });
      });
    }

    // Is the package at the specified version already installed?
    //
    //  * packageName: The string name of the package.
    //  * packageVersion: The string version of the package.
    isPackageInstalled(packageName, packageVersion) {
      try {
        let left;
        const {version} = (left = CSON.readFileSync(CSON.resolve(path.join('node_modules', packageName, 'package')))) != null ? left : {};
        return packageVersion === version;
      } catch (error) {
        return false;
      }
    }

    // Install the package with the given name and optional version
    //
    // metadata - The package metadata object with at least a name key. A version
    //            key is also supported. The version defaults to the latest if
    //            unspecified.
    // options - The installation options object.
    //
    // return value - A Promise; it either rejects with an error, or resolves to an object representing
    //                data from the installed package.js.
    async installRegisteredPackage(metadata, options) {
      const packageName = metadata.name;
      let packageVersion = metadata.version;

      const installGlobally = options.installGlobally ?? true;
      if (!installGlobally) {
        if (packageVersion && this.isPackageInstalled(packageName, packageVersion)) {
          return {};
        }
      }

      let label = packageName;
      if (packageVersion) { label += `@${packageVersion}`; }
      if (!options.argv.json) {
        process.stdout.write(`Installing ${label} `);
        if (installGlobally) {
          process.stdout.write(`to ${this.atomPackagesDirectory} `);
        }
      }

      const commands = [];
      try {
        const pack = await this.requestPackage(packageName);
        packageVersion ??= this.getLatestCompatibleVersion(pack);
        if (!packageVersion) {
          throw `No available version compatible with the installed Atom version: ${this.installedAtomVersion}`;
        }
        const {tarball} = pack.versions[packageVersion]?.dist ?? {};
        if (!tarball) {
          throw `Package version: ${packageVersion} not found`;
        }
        commands.push(async () => await this.installModule(options, pack, tarball));
        if (installGlobally && (packageName.localeCompare(pack.name, 'en', {sensitivity: 'accent'}) !== 0)) {
          commands.push(async newPack => { // package was renamed; delete old package folder
            fs.removeSync(path.join(this.atomPackagesDirectory, packageName));
            return newPack;
          });
        }
        commands.push(async ({installPath}) => {
          if (installPath == null) {
            return {};
          }

          metadata = JSON.parse(fs.readFileSync(path.join(installPath, 'package.json'), 'utf8'));
          const json = {installPath, metadata};
          return json;
        }); // installed locally, no install path data
      } catch (error) {
        this.logFailure();
        throw error;
      }

      try {
        const json = await async.waterfall(commands);
        if (!installGlobally) {
            if (!options.argv.json) { this.logSuccess(); }
        }
        return json;
      } catch (error) {
        if (!installGlobally) {
          this.logFailure();
        }
        throw error;
      }
    }

    // Install the package with the given name and local path
    //
    // packageName - The name of the package
    // packagePath - The local path of the package in the form "file:./packages/package-name"
    // options     - The installation options object.
    //
    // return value - A Promise that resolves to the object representing the installed package.json
    //                or rejects with an error.
    async installLocalPackage(packageName, packagePath, options) {
      if (options.argv.json) {
        return;
      }

      process.stdout.write(`Installing ${packageName} from ${packagePath.slice('file:'.length)} `);
      const commands = [];
      commands.push(next => {
        return this.installModule(options, {name: packageName}, packagePath).then(value => void next(null, value), next);
      });
      commands.push(({installPath}, next) => {
        if (installPath != null) {
          const metadata = JSON.parse(fs.readFileSync(path.join(installPath, 'package.json'), 'utf8'));
          const json = {installPath, metadata};
          return next(null, json);
        } else {
          return next(null, {});
        }
      }); // installed locally, no install path data

      try {
        const json = await async.waterfall(commands);
        if (!options.argv.json) { this.logSuccess(); }
        return json;
      } catch (error) {
        this.logFailure();
        throw error;
      }
    }

    // Install all the package dependencies found in the package.json file.
    //
    // options - The installation options
    //
    // return value - A Promise that rejects with an error or resolves without a value
    async installPackageDependencies(options) {
      options = _.extend({}, options, {installGlobally: false});
      const commands = [];
      const object = this.getPackageDependencies(options.cwd);
      for (let name in object) {
        const version = object[name];
        commands.push(async () => {
            if (this.repoLocalPackagePathRegex.test(version)) {
              await this.installLocalPackage(name, version, options);
            } else {
              await this.installRegisteredPackage({name, version}, options);
            }
        });
      }

      await async.series(commands);
    }

    async installDependencies(options) {
      options.installGlobally = false;
      const commands = [];
      commands.push(async () => void await this.installModules(options));
      commands.push(async () => void await this.installPackageDependencies(options));

      await async.waterfall(commands);
    }

    // Get all package dependency names and versions from the package.json file.
    getPackageDependencies(cloneDir) {
      try {
        let left;
        const fileName = path.join((cloneDir || '.'), 'package.json');
        const metadata = fs.readFileSync(fileName, 'utf8');
        const {packageDependencies, dependencies} = (left = JSON.parse(metadata)) != null ? left : {};

        if (!packageDependencies) { return {}; }
        if (!dependencies) { return packageDependencies; }

        // This code filters out any `packageDependencies` that have an equivalent
        // normalized repo-local package path entry in the `dependencies` section of
        // `package.json`.  Versioned `packageDependencies` are always returned.
        const filteredPackages = {};
        for (let packageName in packageDependencies) {
          const packageSpec = packageDependencies[packageName];
          const dependencyPath = this.getRepoLocalPackagePath(dependencies[packageName]);
          const packageDependencyPath = this.getRepoLocalPackagePath(packageSpec);
          if (!packageDependencyPath || (dependencyPath !== packageDependencyPath)) {
            filteredPackages[packageName] = packageSpec;
          }
        }

        return filteredPackages;
      } catch (error) {
        return {};
      }
    }

    getRepoLocalPackagePath(packageSpec) {
      if (!packageSpec) { return undefined; }
      const repoLocalPackageMatch = packageSpec.match(this.repoLocalPackagePathRegex);
      if (repoLocalPackageMatch) {
        return path.normalize(repoLocalPackageMatch[1]);
      } else {
        return undefined;
      }
    }

    createAtomDirectories() {
      fs.makeTreeSync(this.atomDirectory);
      fs.makeTreeSync(this.atomPackagesDirectory);
      return fs.makeTreeSync(this.atomNodeDirectory);
    }

    // Compile a sample native module to see if a useable native build toolchain
    // is instlalled and successfully detected. This will include both Python
    // and a compiler.
    checkNativeBuildTools() {
      process.stdout.write('Checking for native build tools ');

      const buildArgs = ['--globalconfig', config.getGlobalConfigPath(), '--userconfig', config.getUserConfigPath(), 'build'];
      buildArgs.push(path.resolve(__dirname, '..', 'native-module'));
      buildArgs.push(...this.getNpmBuildFlags());

      fs.makeTreeSync(this.atomDirectory);

      const env = _.extend({}, process.env, {HOME: this.atomNodeDirectory, RUSTUP_HOME: config.getRustupHomeDirPath()});
      this.addBuildEnvVars(env);

      const buildOptions = {env};
      if (this.verbose) { buildOptions.streaming = true; }

      fs.removeSync(path.resolve(__dirname, '..', 'native-module', 'build'));

      return new Promise((resolve, reject) => 
        void this.fork(this.atomNpmPath, buildArgs, buildOptions, (...args) =>
          void this.logCommandResults(...args).then(resolve, reject)
        )
      );
    }

    packageNamesFromPath(filePath) {
      filePath = path.resolve(filePath);

      if (!fs.isFileSync(filePath)) {
        throw new Error(`File '${filePath}' does not exist`);
      }

      const packages = fs.readFileSync(filePath, 'utf8');
      return this.sanitizePackageNames(packages.split(/\s/));
    }

    buildModuleCache(packageName) {
      const packageDirectory = path.join(this.atomPackagesDirectory, packageName);
      const rebuildCacheCommand = new RebuildModuleCache();
      return new Promise((resolve, _reject) =>
        void rebuildCacheCommand.rebuild(packageDirectory, () => resolve()) // Ignore cache errors and just finish the install
      );
    }

    async warmCompileCache(packageName) {
      const packageDirectory = path.join(this.atomPackagesDirectory, packageName);

      const resourcePath = await this.getResourcePath();
      try {
        const CompileCache = require(path.join(resourcePath, 'src', 'compile-cache'));

        const onDirectory = directoryPath => path.basename(directoryPath) !== 'node_modules';

        const onFile = filePath => {
          try {
            return CompileCache.addPathToCache(filePath, this.atomDirectory);
          } catch (error) {}
        };

        fs.traverseTreeSync(packageDirectory, onFile, onDirectory);
      } catch (error) {}
    }

    async isBundledPackage(packageName) {
      const resourcePath = await this.getResourcePath();
      let atomMetadata;
      try {
        atomMetadata = JSON.parse(fs.readFileSync(path.join(resourcePath, 'package.json')));
      } catch (error) {
        return false;
      }

      return atomMetadata?.packageDependencies?.hasOwnProperty(packageName);
    }

    getLatestCompatibleVersion(pack) {
      if (!this.installedAtomVersion) {
        if (isDeprecatedPackage(pack.name, pack.releases.latest)) {
          return null;
        } else {
          return pack.releases.latest;
        }
      }

      let latestVersion = null;
      const object = pack.versions != null ? pack.versions : {};
      for (let version in object) {
        const metadata = object[version];
        if (!semver.valid(version)) { continue; }
        if (!metadata) { continue; }
        if (isDeprecatedPackage(pack.name, version)) { continue; }

        const {
          engines
        } = metadata;
        const engine = engines?.pulsar || engines?.atom || '*';
        if (!semver.validRange(engine)) { continue; }
        if (!semver.satisfies(this.installedAtomVersion, engine)) { continue; }

        if (latestVersion == null) { latestVersion = version; }
        if (semver.gt(version, latestVersion)) { latestVersion = version; }
      }

      return latestVersion;
    }

    getHostedGitInfo(name) {
      return hostedGitInfo.fromUrl(name);
    }

    async installGitPackage(packageUrl, options, version) {
      const tasks = [];

      const cloneDir = temp.mkdirSync("atom-git-package-clone-");

      const urls = this.getNormalizedGitUrls(packageUrl);
      await this.cloneFirstValidGitUrl(urls, cloneDir, options);

      const data = {};
      if (version) {
        const repo = Git.open(cloneDir);
        data.sha = version;
        const checked = repo.checkoutRef(`refs/tags/${version}`, false) || repo.checkoutReference(version, false);
        if (!checked) { throw `Can't find the branch, tag, or commit referenced by ${version}`; }
      } else {
        const sha = this.getRepositoryHeadSha(cloneDir);
        data.sha = sha;
      }

      await this.installGitPackageDependencies(cloneDir, options);

      const metadataFilePath = CSON.resolve(path.join(cloneDir, 'package'));
      const metadata = CSON.readFileSync(metadataFilePath);
      data.metadataFilePath = metadataFilePath;
      data.metadata = metadata;

      data.metadata.apmInstallSource = {
        type: "git",
        source: packageUrl,
        sha: data.sha
      };
      CSON.writeFileSync(data.metadataFilePath, data.metadata);

      const {name} = data.metadata;
      const targetDir = path.join(this.atomPackagesDirectory, name);
      if (!options.argv.json) { process.stdout.write(`Moving ${name} to ${targetDir} `); }
      await fs.cp(cloneDir, targetDir);
      if (!options.argv.json) { this.logSuccess(); }
      const json = {installPath: targetDir, metadata: data.metadata};
      return json;
    }

    getNormalizedGitUrls(packageUrl) {
      const packageInfo = this.getHostedGitInfo(packageUrl);

      if (packageUrl.indexOf('file://') === 0) {
        return [packageUrl];
      } else if (packageInfo.default === 'sshurl') {
        return [packageInfo.toString()];
      } else if (packageInfo.default === 'https') {
        return [packageInfo.https().replace(/^git\+https:/, "https:")];
      } else if (packageInfo.default === 'shortcut') {
        return [
          packageInfo.https().replace(/^git\+https:/, "https:"),
          packageInfo.sshurl()
        ];
      }
    }

    async cloneFirstValidGitUrl(urls, cloneDir, options) {
      try {
        const result = await async.detectSeries(urls, async url =>
          await this.cloneNormalizedUrl(url, cloneDir, options).then(() => true, () => false)
        );
        if (!result) {
          throw 'Missing result.';
        }
      } catch (error) {
        const invalidUrls = `Couldn't clone ${urls.join(' or ')}`;
        const invalidUrlsError = new Error(invalidUrls);
        throw invalidUrlsError;
      }
    }

    async cloneNormalizedUrl(url, cloneDir, options) {
      // Require here to avoid circular dependency
      const Develop = require('./develop');
      const develop = new Develop();

      await develop.cloneRepository(url, cloneDir, options);
    }

    async installGitPackageDependencies(directory, options) {
      options.cwd = directory;
      await this.installDependencies(options);
    }

    getRepositoryHeadSha(repoDir) {
      const repo = Git.open(repoDir);
      const sha = repo.getReferenceTarget("HEAD");
      return sha;
    }

    async run(options) {
      let packageNames;
      options = this.parseOptions(options.commandArgs);
      const packagesFilePath = options.argv['packages-file'];

      this.createAtomDirectories();

      if (options.argv.check) {
        try {
          const npm = await config.loadNpm();
          this.npm = npm;
          await this.loadInstalledAtomMetadata();
          await this.checkNativeBuildTools();
        } catch (error) {
          return error; //errors as return values atm
        }
        return;
      }

      this.verbose = options.argv.verbose;
      if (this.verbose) {
        process.env.NODE_DEBUG = 'request';
      }

      const installPackage = async name => {
        const gitPackageInfo = this.getHostedGitInfo(name);

        if (gitPackageInfo || (name.indexOf('file://') === 0)) {
          return await this.installGitPackage(name, options, options.argv.branch || options.argv.tag);
        }
        if (name === '.') {
          await this.installDependencies(options);
          return;
        }
        
        // is registered package
        let version;
        const atIndex = name.indexOf('@');
        if (atIndex > 0) {
          version = name.substring(atIndex + 1);
          name = name.substring(0, atIndex);
        }

        const isBundledPackage = await this.isBundledPackage(name);
        if (isBundledPackage) {
          console.error(`\
The ${name} package is bundled with Pulsar and should not be explicitly installed.
You can run \`ppm uninstall ${name}\` to uninstall it and then the version bundled
with Pulsar will be used.\
`.yellow
          );
        }
        return await this.installRegisteredPackage({name, version}, options);
      };

      if (packagesFilePath) {
        try {
          packageNames = this.packageNamesFromPath(packagesFilePath);
        } catch (error) {
          return error; //errors as return values atm
        }
      } else {
        packageNames = this.packageNamesFromArgv(options.argv);
        if (packageNames.length === 0) { packageNames.push('.'); }
      }

      const commands = [];
      commands.push(async () => {
        const npm = await config.loadNpm();
        this.npm = npm;
      });
      commands.push(async () => {
        await this.loadInstalledAtomMetadata();
      });
      packageNames.forEach(packageName =>
        void commands.push(async () => await installPackage(packageName))
      );
      const iteratee = async fn => await fn();
      try {
        let installedPackagesInfo = await async.mapSeries(commands, iteratee);
        installedPackagesInfo = _.compact(installedPackagesInfo);
        installedPackagesInfo = installedPackagesInfo.filter((item, idx) => packageNames[idx] !== ".");
        if (options.argv.json) { console.log(JSON.stringify(installedPackagesInfo, null, "  ")); }
      } catch (error) {
        return error; //errors as return values atm
      }
    }
  }
