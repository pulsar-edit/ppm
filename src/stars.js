
const _ = require('underscore-plus');
const yargs = require('yargs');

const Command = require('./command');
const config = require('./apm');
const Install = require('./install');
const Login = require('./login');
const request = require('./request');
const tree = require('./tree');

module.exports =
class Stars extends Command {
  static commandNames = [ "stars", "starred" ];

    parseOptions(argv) {
      const options = yargs(argv).wrap(Math.min(100, yargs.terminalWidth()));
      options.usage(`\

Usage: ppm stars
       ppm stars --install
       ppm stars --user thedaniel
       ppm stars --themes

List or install starred Atom packages and themes.\
`
      );
      options.alias('h', 'help').describe('help', 'Print this usage message');
      options.alias('i', 'install').boolean('install').describe('install', 'Install the starred packages');
      options.alias('t', 'themes').boolean('themes').describe('themes', 'Only list themes');
      options.alias('u', 'user').string('user').describe('user', 'GitHub username to show starred packages for');
      return options.boolean('json').describe('json', 'Output packages as a JSON array');
    }

    async getStarredPackages(user, atomVersion) {
      const requestSettings = {json: true};
      if (atomVersion) { requestSettings.qs = {engine: atomVersion}; }

      if (user) {
        requestSettings.url = `${config.getAtomApiUrl()}/users/${user}/stars`;
        return this.requestStarredPackages(requestSettings);
      }

      requestSettings.url = `${config.getAtomApiUrl()}/stars`;
      const token = await Login.getTokenOrLogin();
      requestSettings.headers = {authorization: token};
      return this.requestStarredPackages(requestSettings);
    }

    async requestStarredPackages(requestSettings) {
        const response = await request.get(requestSettings);
        const body = response.body ?? [];
        if (response.statusCode === 200) {
          let packages = body.filter(pack => pack?.releases?.latest != null);
          packages = packages.map(({readme, metadata, downloads, stargazers_count}) => _.extend({}, metadata, {readme, downloads, stargazers_count}));
          packages = _.sortBy(packages, 'name');
          return packages;
        }

        const message = request.getErrorMessage(body, null);
        throw `Requesting packages failed: ${message}`;
    }

    async installPackages(packages) {
      if (packages.length === 0) { return; }

      const commandArgs = packages.map(({name}) => name);
      return new Install().run({commandArgs});
    }

    logPackagesAsJson(packages) {
      console.log(JSON.stringify(packages));
    }

    logPackagesAsText(user, packagesAreThemes, packages) {
      const userLabel = user ?? 'you';
      let label = `${packagesAreThemes ? 'Themes' : 'Packages'} starred by ${userLabel}`;
      console.log(`${label.cyan} (${packages.length})`);

      tree(packages, ({name, description, downloads, stargazers_count}) => {
        label = name.yellow;
        if (process.platform === 'darwin') { label = `\u2B50  ${label}`; }
        if (description) { label += ` ${description.replace(/\s+/g, ' ')}`; }
        if ((downloads >= 0) && (stargazers_count >= 0)) { label += ` (${_.pluralize(downloads, 'download')}, ${_.pluralize(stargazers_count, 'star')})`.grey; }
        return label;
      });

      console.log();
      console.log(`Use \`ppm stars --install\` to install them all or visit ${'https://web.pulsar-edit.dev'.underline} to read more about them.`);
      console.log();
    }

    async run(options) {
      options = this.parseOptions(options.commandArgs);
      const user = options.argv.user?.toString().trim();

      let packages;
      try {
        packages = await this.getStarredPackages(user, options.argv.compatible);
      } catch (error) {
        return error; //errors as values for now
      }
      if (options.argv.themes) {
        packages = packages.filter(({theme}) => theme);
      }

      if (options.argv.install) {
        return await this.installPackages(packages);
      }
      if (options.argv.json) {
        return void this.logPackagesAsJson(packages);
      }

      this.logPackagesAsText(user, options.argv.themes, packages);
    }
  }
