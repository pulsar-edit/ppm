
const _ = require('underscore-plus');
const yargs = require('yargs');

const Command = require('./command');
const config = require('./apm');
const request = require('./request');
const tree = require('./tree');
const {isDeprecatedPackage} = require('./deprecated-packages');

module.exports =
class Search extends Command {
  static commandNames = [ "search" ];


    parseOptions(argv) {
      const options = yargs(argv).wrap(Math.min(100, yargs.terminalWidth()));
      options.usage(`\

Usage: ppm search <package_name>

Search for packages/themes.\
`
      );
      options.alias('h', 'help').describe('help', 'Print this usage message');
      options.boolean('json').describe('json', 'Output matching packages as JSON array');
      options.boolean('packages').describe('packages', 'Search only non-theme packages').alias('p', 'packages');
      return options.boolean('themes').describe('themes', 'Search only themes').alias('t', 'themes');
    }

    async searchPackages(query, opts) {
      const qs =
        {q: query};

      if (opts.packages) {
        qs.filter = 'package';
      } else if (opts.themes) {
        qs.filter = 'theme';
      }

      const requestSettings = {
        url: `${config.getAtomPackagesUrl()}/search`,
        qs,
        json: true
      };

      const response = await request.get(requestSettings);
      const body = response.body ?? {};

      if (response.statusCode === 200) {
        let packages = body.filter(pack => pack?.releases?.latest != null);
        packages = packages.map(({readme, metadata, downloads, stargazers_count}) => ({
          ...metadata,
          readme,
          downloads,
          stargazers_count
        }));
        packages = packages.filter(({name, version}) => !isDeprecatedPackage(name, version));
        return packages;
      }

      const message = request.getErrorMessage(body, null);
      throw `Searching packages failed: ${message}`;
    }

    async run(options) {
      options = this.parseOptions(options.commandArgs);
      const [query] = options.argv._;

      if (!query) {
        return "Missing required search query"; // error as return value on this layer atm
      }

      const searchOptions = {
        packages: options.argv.packages,
        themes: options.argv.themes
      };

      let packages;
      try {
        packages = await this.searchPackages(query, searchOptions);
      } catch (error) {
        return error; // error as return value on this layer atm
      }

      if (options.argv.json) {
        console.log(JSON.stringify(packages));
      } else {
        const heading = `Search Results For '${query}'`.cyan;
        console.log(`${heading} (${packages.length})`);

        tree(packages, ({name, description, downloads, stargazers_count}) => {
          let label = name.yellow;
          if (description) { label += ` ${description.replace(/\s+/g, ' ')}`; }
          if ((downloads >= 0) && (stargazers_count >= 0)) { label += ` (${_.pluralize(downloads, 'download')}, ${_.pluralize(stargazers_count, 'star')})`.grey; }
          return label;
        });

        console.log();
        console.log(`Use \`ppm install\` to install them or visit ${'https://web.pulsar-edit.dev'.underline} to read more about them.`);
        console.log();
      }
    }
  }
