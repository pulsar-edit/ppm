
const _ = require('underscore-plus');
const yargs = require('yargs');

const Command = require('./command');
const config = require('./apm');
const request = require('./request');
const tree = require('./tree');

module.exports =
class Featured extends Command {
  static commandNames = [ "featured" ];

    parseOptions(argv) {
      const options = yargs(argv).wrap(Math.min(100, yargs.terminalWidth()));
      options.usage(`\

Usage: ppm featured
       ppm featured --themes
       ppm featured --compatible 0.49.0

List the Pulsar packages and themes that are currently featured.\
`
      );
      options.alias('h', 'help').describe('help', 'Print this usage message');
      options.alias('t', 'themes').boolean('themes').describe('themes', 'Only list themes');
      options.alias('c', 'compatible').string('compatible').describe('compatible', 'Only list packages/themes compatible with this Pulsar version');
      return options.boolean('json').describe('json', 'Output featured packages as JSON array');
    }

    getFeaturedPackagesByType(atomVersion, packageType) {

      const requestSettings = {
        url: `${config.getAtomApiUrl()}/${packageType}/featured`,
        json: true
      };
      if (atomVersion) { requestSettings.qs = {engine: atomVersion}; }

      return new Promise((resolve, reject) => void request.get(requestSettings, function(error, response, body) {
        body ??= [];
        if (error != null) {
          return void reject(error);
        }
        if (response.statusCode === 200) {
          let packages = body.filter(pack => (pack != null ? pack.releases : undefined) != null);
          packages = packages.map(({readme, metadata, downloads, stargazers_count}) => _.extend({}, metadata, {readme, downloads, stargazers_count}));
          packages = _.sortBy(packages, 'name');
          return void resolve(packages);
        }
        
        const message = request.getErrorMessage(body, error);
        reject(`Requesting packages failed: ${message}`);
      }));
    }

    async getAllFeaturedPackages(atomVersion) {
      const packages = await this.getFeaturedPackagesByType(atomVersion, 'packages');
      const themes = await this.getFeaturedPackagesByType(atomVersion, 'themes');
      return packages.concat(themes);
    }

    async run(options) {
      options = this.parseOptions(options.commandArgs);

      try {
        const packages = options.argv.themes ? await this.getFeaturedPackagesByType(options.argv.compatible, 'themes') : await this.getAllFeaturedPackages(options.argv.compatible);
        if (options.argv.json) {
          console.log(JSON.stringify(packages));
          return;
        }
        if (options.argv.themes) {
          console.log(`${'Featured Pulsar Themes'.cyan} (${packages.length})`);
        } else {
          console.log(`${'Featured Pulsar Packages'.cyan} (${packages.length})`);
        }

        tree(packages, ({name, version, description, downloads, stargazers_count}) => {
          let label = name.yellow;
          if (description) { label += ` ${description.replace(/\s+/g, ' ')}`; }
          if ((downloads >= 0) && (stargazers_count >= 0)) { label += ` (${_.pluralize(downloads, 'download')}, ${_.pluralize(stargazers_count, 'star')})`.grey; }
          return label;
        });

        console.log();
        console.log(`Use \`ppm install\` to install them or visit ${'https://web.pulsar-edit.dev/'.underline} to read more about them.`);
        console.log();
      } catch (error) {
        return error; //Need to provide all data as the value of the Promise at the moment
      }

    }
  }
