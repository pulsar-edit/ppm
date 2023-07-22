/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
let Featured;
const _ = require('underscore-plus');
const yargs = require('yargs');

const Command = require('./command');
const config = require('./apm');
const request = require('./request');
const tree = require('./tree');

module.exports =
(Featured = (function() {
  Featured = class Featured extends Command {
    static initClass() {
      this.commandNames = ['featured'];
    }

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

    getFeaturedPackagesByType(atomVersion, packageType, callback) {
      if (_.isFunction(atomVersion)) { [callback, atomVersion] = [atomVersion, null]; }

      const requestSettings = {
        url: `${config.getAtomApiUrl()}/${packageType}/featured`,
        json: true
      };
      if (atomVersion) { requestSettings.qs = {engine: atomVersion}; }

      return request.get(requestSettings, function(error, response, body) {
        if (body == null) { body = []; }
        if (error != null) {
          return callback(error);
        } else if (response.statusCode === 200) {
          let packages = body.filter(pack => (pack != null ? pack.releases : undefined) != null);
          packages = packages.map(({readme, metadata, downloads, stargazers_count}) => _.extend({}, metadata, {readme, downloads, stargazers_count}));
          packages = _.sortBy(packages, 'name');
          return callback(null, packages);
        } else {
          const message = request.getErrorMessage(response, body);
          return callback(`Requesting packages failed: ${message}`);
        }
      });
    }

    getAllFeaturedPackages(atomVersion, callback) {
      return this.getFeaturedPackagesByType(atomVersion, 'packages', (error, packages) => {
        if (error != null) { return callback(error); }

        return this.getFeaturedPackagesByType(atomVersion, 'themes', function(error, themes) {
          if (error != null) { return callback(error); }
          return callback(null, packages.concat(themes));
        });
      });
    }

    run(options) {
      const {callback} = options;
      options = this.parseOptions(options.commandArgs);

      const listCallback = function(error, packages) {
        if (error != null) { return callback(error); }

        if (options.argv.json) {
          console.log(JSON.stringify(packages));
        } else {
          if (options.argv.themes) {
            console.log(`${'Featured Pulsar Themes'.cyan} (${packages.length})`);
          } else {
            console.log(`${'Featured Pulsar Packages'.cyan} (${packages.length})`);
          }

          tree(packages, function({name, version, description, downloads, stargazers_count}) {
            let label = name.yellow;
            if (description) { label += ` ${description.replace(/\s+/g, ' ')}`; }
            if ((downloads >= 0) && (stargazers_count >= 0)) { label += ` (${_.pluralize(downloads, 'download')}, ${_.pluralize(stargazers_count, 'star')})`.grey; }
            return label;
          });

          console.log();
          console.log(`Use \`ppm install\` to install them or visit ${'https://web.pulsar-edit.dev/'.underline} to read more about them.`);
          console.log();
        }

        return callback();
      };

      if (options.argv.themes) {
        return this.getFeaturedPackagesByType(options.argv.compatible, 'themes', listCallback);
      } else {
        return this.getAllFeaturedPackages(options.argv.compatible, listCallback);
      }
    }
  };
  Featured.initClass();
  return Featured;
})());
