
const _ = require('underscore-plus');
const yargs = require('yargs');
const semver = require('semver');

const Command = require('./command');
const config = require('./apm');
const request = require('./request');
const tree = require('./tree');

module.exports =
class View extends Command {
  static promiseBased = true;
  static commandNames = [ "view", "show" ];

    parseOptions(argv) {
      const options = yargs(argv).wrap(Math.min(100, yargs.terminalWidth()));
      options.usage(`\

Usage: ppm view <package_name>

View information about a package/theme.\
`
      );
      options.alias('h', 'help').describe('help', 'Print this usage message');
      options.boolean('json').describe('json', 'Output featured packages as JSON array');
      return options.string('compatible').describe('compatible', 'Show the latest version compatible with this Atom version');
    }

    loadInstalledAtomVersion(options) {
      return new Promise((resolve, _reject) => {
        process.nextTick(() => {
          let installedAtomVersion;
          if (options.argv.compatible) {
            const version = this.normalizeVersion(options.argv.compatible);
            if (semver.valid(version)) { installedAtomVersion = version; }
          }
          return resolve(installedAtomVersion);
        });
      });
    }

    async getLatestCompatibleVersion(pack, options) {
      const installedAtomVersion = await this.loadInstalledAtomVersion(options);
      if (!installedAtomVersion) { return pack.releases.latest; }

      let latestVersion = null;
      const object = pack?.versions ?? {};
      for (let version in object) {
        const metadata = object[version];
        if (!semver.valid(version)) { continue; }
        if (!metadata) { continue; }

        const engine = metadata.engines?.pulsar ?? metadata.engines?.atom ?? "*";
        if (!semver.validRange(engine)) { continue; }
        if (!semver.satisfies(installedAtomVersion, engine)) { continue; }

        latestVersion ??= version;
        if (semver.gt(version, latestVersion)) { latestVersion = version; }
      }

      return latestVersion;
    }

    getRepository(pack) {
      let repository = pack.repository?.url ?? pack.repository;;
      if (repository) {
        return repository.replace(/\.git$/, '');
      }
    }

    getPackage(packageName, options) {
      const requestSettings = {
        url: `${config.getAtomPackagesUrl()}/${packageName}`,
        json: true
      };
      return new Promise((resolve, reject) => {
        request.get(requestSettings, (error, response, body) => {
          body ??= {};
          if (error != null) {
            return void reject(error);
          }
          if (response.statusCode !== 200) {
            const message = body.message ?? body.error ?? body;
            return void reject(`Requesting package failed: ${message}`);
          }

          this.getLatestCompatibleVersion(body, options).then(version => {
            const {name, readme, downloads, stargazers_count} = body;
            const metadata = body.versions?.[version] ?? {name};
            const pack = _.extend({}, metadata, {readme, downloads, stargazers_count});
            resolve(pack);
          });
        });
      });
    }

    async run(options) {
      options = this.parseOptions(options.commandArgs);
      const [packageName] = options.argv._;

      if (!packageName) {
        return "Missing required package name"; //errors as return values atm
      }

      let pack;
      try {
        pack = await this.getPackage(packageName, options);
      } catch (error) {
        return error; //errors as return values atm
      }

      if (options.argv.json) {
        console.log(JSON.stringify(pack, null, 2));
        return;
      }


      console.log(`${pack.name.cyan}`);
      const items = [];
      if (pack.version) { items.push(pack.version.yellow); }
      const repository = this.getRepository(pack);
      if (repository) {
        items.push(repository.underline);
      }
      if (pack.description) { items.push(pack.description.replace(/\s+/g, ' ')); }
      if (pack.downloads >= 0) {
        items.push(_.pluralize(pack.downloads, 'download'));
      }
      if (pack.stargazers_count >= 0) {
        items.push(_.pluralize(pack.stargazers_count, 'star'));
      }

      tree(items);

      console.log();
      console.log(`Run \`ppm install ${pack.name}\` to install this package.`);
      console.log();
    }
  }
