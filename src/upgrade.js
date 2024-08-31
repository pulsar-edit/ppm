
const path = require('path');

const _ = require('underscore-plus');
const async = require('async');
const yargs = require('yargs');
const read = require('read');
const semver = require('semver');
const Git = require('git-utils');

const Command = require('./command');
const config = require('./apm');
const fs = require('./fs');
const Install = require('./install');
const Packages = require('./packages');
const request = require('./request');
const tree = require('./tree');
const git = require('./git');

module.exports =
class Upgrade extends Command {
  static commandNames = [ "upgrade", "outdated", "update" ];

    constructor() {
      super();
      this.atomDirectory = config.getAtomDirectory();
      this.atomPackagesDirectory = path.join(this.atomDirectory, 'packages');
    }

    parseOptions(argv) {
      const options = yargs(argv).wrap(Math.min(100, yargs.terminalWidth()));
      options.usage(`\

Usage: ppm upgrade
       ppm upgrade --list
       ppm upgrade [<package_name>...]

Upgrade out of date packages installed to ~/.pulsar/packages

This command lists the out of date packages and then prompts to install
available updates.\
`
      );
      options.alias('c', 'confirm').boolean('confirm').default('confirm', true).describe('confirm', 'Confirm before installing updates');
      options.alias('h', 'help').describe('help', 'Print this usage message');
      options.alias('l', 'list').boolean('list').describe('list', 'List but don\'t install the outdated packages');
      options.boolean('json').describe('json', 'Output outdated packages as a JSON array');
      options.string('compatible').describe('compatible', 'Only list packages/themes compatible with this Atom version');
      return options.boolean('verbose').default('verbose', false).describe('verbose', 'Show verbose debug information');
    }

    getInstalledPackages(options) {
      let packages = [];
      for (let name of fs.list(this.atomPackagesDirectory)) {
        let pack = this.getIntalledPackage(name);
        if (pack) {
          packages.push(pack);
        }
      }

      const packageNames = this.packageNamesFromArgv(options.argv);
      if (packageNames.length > 0) {
        packages = packages.filter(({name}) => packageNames.indexOf(name) !== -1);
      }

      return packages;
    }

    getIntalledPackage(name) {
      const packageDirectory = path.join(this.atomPackagesDirectory, name);
      if (fs.isSymbolicLinkSync(packageDirectory)) { return; }
      try {
        const metadata = JSON.parse(fs.readFileSync(path.join(packageDirectory, 'package.json')));
        if (metadata?.name && metadata?.version) { return metadata; }
      } catch (error) {}
    }

    async loadInstalledAtomVersion(options) {
      if (options.argv.compatible) {
        return new Promise((resolve, _reject) => {
          process.nextTick(() => {
            const version = this.normalizeVersion(options.argv.compatible);
            if (semver.valid(version)) { this.installedAtomVersion = version; }
            resolve();
          });
        });
      }

      return await this.loadInstalledAtomMetadata();
    }

    folderIsRepo(pack) {
      const repoGitFolderPath = path.join(this.atomPackagesDirectory, pack.name, '.git');
      return fs.existsSync(repoGitFolderPath);
    }

    async getLatestVersion(pack) {
      const requestSettings = {
        url: `${config.getAtomPackagesUrl()}/${pack.name}`,
        json: true
      };
      const response = await request.get(requestSettings).catch(error => Promise.reject(`Request for package information failed: ${error.message}`));
      const body = response.body ?? {};
      if (response.statusCode === 404) {
        return;
      }
      if (response.statusCode !== 200) {
        const message = body.message ?? body.error ?? body;
        throw `Request for package information failed: ${message}`;
      }

      const atomVersion = this.installedAtomVersion;
      let latestVersion = pack.version;
      const object = body?.versions ?? {};
      for (let version in object) {
        const metadata = object[version];
        if (!semver.valid(version)) { continue; }
        if (!metadata) { continue; }

        const engine = metadata.engines?.pulsar || metadata.engines?.atom || '*';
        if (!semver.validRange(engine)) { continue; }
        if (!semver.satisfies(atomVersion, engine)) { continue; }

        if (!semver.gt(version, latestVersion)) { continue; }

        latestVersion = version;
      }

      if ((latestVersion === pack.version) || !this.hasRepo(pack)) {
        return;
      }

      return latestVersion;
    }

    async getLatestSha(pack) {
      const repoPath = path.join(this.atomPackagesDirectory, pack.name);
      const repo = Git.open(repoPath);

      const command = await config.getSetting('git') ?? 'git';
      const args = ['fetch', 'origin', repo.getShortHead()];
      git.addGitToEnv(process.env);
      return new Promise((resolve, reject) => {
        this.spawn(command, args, {cwd: repoPath}, (code, stderr, stdout) => {
          stderr ??= '';
          stdout ??= '';
          if (code !== 0) {
            return void reject(new Error('Exit code: ' + code + ' - ' + stderr));
          }

          const sha = repo.getReferenceTarget(repo.getUpstreamBranch(repo.getHead()));
          if (sha !== pack.apmInstallSource.sha) {
            return void resolve(sha);
          }
          resolve();
        });
      });
    }

    hasRepo(pack) {
      return (Packages.getRepository(pack) != null);
    }

    async getAvailableUpdates(packages) {
      const getLatestVersionOrSha = async pack => {
        if (this.folderIsRepo(pack) && (pack.apmInstallSource?.type === 'git')) {
          return await this.getLatestSha(pack).then(sha => ({pack, sha}));
        }

        return await this.getLatestVersion(pack).then(latestVersion => ({pack, latestVersion}));
      };

      let updates = await async.mapLimit(packages, 10, getLatestVersionOrSha);
      updates = _.filter(updates, update => (update.latestVersion != null) || (update.sha != null));
      updates.sort((updateA, updateB) => updateA.pack.name.localeCompare(updateB.pack.name));
      return updates;
    }

    promptForConfirmation() {
      return new Promise((resolve, reject) => {
        read({prompt: 'Would you like to install these updates? (yes)', edit: true}, (error, answer) => {
          if (error != null) {
            return void reject(error);
          }
          answer = answer ? answer.trim().toLowerCase() : 'yes';
          resolve((answer === 'y') || (answer === 'yes'));
        });
      });
    }

    async installUpdates(updates) {
      const installCommands = [];
      for (let {pack, latestVersion} of Array.from(updates)) {
        installCommands.push(async () => {
          const commandArgs = pack.apmInstallSource?.type === 'git'
            ? [pack.apmInstallSource.source]
            : [`${pack.name}@${latestVersion}`];
          if (this.verbose) { commandArgs.unshift('--verbose'); }
          await new Install().run({commandArgs});
        });
      }

      await async.waterfall(installCommands);
    }

    async run(options) {
      const {command} = options;
      options = this.parseOptions(options.commandArgs);
      options.command = command;

      this.verbose = options.argv.verbose;
      if (this.verbose) {
        process.env.NODE_DEBUG = 'request';
      }

      try {
        await this.loadInstalledAtomVersion(options);
        if (!this.installedAtomVersion) {
          return 'Could not determine current Atom version installed'; //errors as return values atm
        }

        await this.upgradePackages(options);
      } catch (error) {
        return error; //rewiring error as return value
      }
    }

    async upgradePackages(options) {
      const packages = this.getInstalledPackages(options);
      const updates = await this.getAvailableUpdates(packages);

      if (options.argv.json) {
        const packagesWithLatestVersionOrSha = updates.map(({pack, latestVersion, sha}) => {
          if (latestVersion) { pack.latestVersion = latestVersion; }
          if (sha) { pack.latestSha = sha; }
          return pack;
        });
        console.log(JSON.stringify(packagesWithLatestVersionOrSha));
      } else {
        console.log("Package Updates Available".cyan + ` (${updates.length})`);
        tree(updates, ({pack, latestVersion, sha}) => {
          let {name, apmInstallSource, version} = pack;
          name = name.yellow;
          if (sha != null) {
            version = apmInstallSource.sha.substr(0, 8).red;
            latestVersion = sha.substr(0, 8).green;
          } else {
            version = version.red;
            latestVersion = latestVersion.green;
          }
          latestVersion = latestVersion?.green || apmInstallSource?.sha?.green;
          return `${name} ${version} -> ${latestVersion}`;
        });
      }

      if (options.command === 'outdated') { return; }
      if (options.argv.list) { return; }
      if (updates.length === 0) { return; }

      console.log();
      if (options.argv.confirm) {
        const confirmed = await this.promptForConfirmation();
        if (confirmed) {
          console.log();
          await this.installUpdates(updates);
        }
        return;
      }

      await this.installUpdates(updates);
    }
  }
