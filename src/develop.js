
const fs = require('fs');
const path = require('path');

const yargs = require('yargs');

const config = require('./apm');
const Command = require('./command');
const Install = require('./install');
const git = require('./git');
const Link = require('./link');
const request = require('./request');

module.exports =
class Develop extends Command {
  static commandNames = [ "dev", "develop" ];

    constructor() {
      super();
      this.atomDirectory = config.getAtomDirectory();
      this.atomDevPackagesDirectory = path.join(this.atomDirectory, 'dev', 'packages');
    }

    parseOptions(argv) {
      const options = yargs(argv).wrap(Math.min(100, yargs.terminalWidth()));

      options.usage(`\
Usage: ppm develop <package_name> [<directory>]

Clone the given package's Git repository to the directory specified,
install its dependencies, and link it for development to
~/.pulsar/dev/packages/<package_name>.

If no directory is specified then the repository is cloned to
~/github/<package_name>. The default folder to clone packages into can
be overridden using the ATOM_REPOS_HOME environment variable.

Once this command completes you can open a dev window from atom using
cmd-shift-o to run the package out of the newly cloned repository.\
`
      );
      return options.alias('h', 'help').describe('help', 'Print this usage message');
    }

    async getRepositoryUrl(packageName) {
      const requestSettings = {
        url: `${config.getAtomPackagesUrl()}/${packageName}`,
        json: true
      };
      const response = await request.get(requestSettings).catch(error => Promise.reject(`Request for package information failed: ${request.getErrorMessage(null, error)}`));
      const body = response.body ?? {};

      if (response.statusCode === 200) {
        const repositoryUrl = body.repository.url;
        if (repositoryUrl) {
          return repositoryUrl;
        }

        throw `No repository URL found for package: ${packageName}`;
      }

      const message = request.getErrorMessage(body, null);
      throw `Request for package information failed: ${message}`;
    }

    async cloneRepository(repoUrl, packageDirectory, options) {
      const command = await config.getSetting('git') ?? 'git';
      const args = ['clone', '--recursive', repoUrl, packageDirectory];
      if (!options.argv.json) { process.stdout.write(`Cloning ${repoUrl} `); }
      git.addGitToEnv(process.env);
      return new Promise((resolve, reject) => {
        this.spawn(command, args, (...args) => {
          if (options.argv.json) {
            return void this.logCommandResultsIfFail(...args).then(resolve, reject);
          }

          this.logCommandResults(...args).then(resolve, reject);
        });
      });
    }

    installDependencies(packageDirectory, options) {
      process.chdir(packageDirectory);

      return new Install().run({...options}); // pass options shallow-copied - protects somewhat from mutations
    }

    linkPackage(packageDirectory, options) {
      const linkOptions = {
        ...options,
        commandArgs: [packageDirectory, '--dev']
      };

      return new Link().run(linkOptions);
    }

    async run(options) {
      const packageName = options.commandArgs.shift();

      if (!((packageName != null ? packageName.length : undefined) > 0)) {
        return Promise.resolve("Missing required package name");
      }

      let packageDirectory = options.commandArgs.shift() ?? path.join(config.getReposDirectory(), packageName);
      packageDirectory = path.resolve(packageDirectory);

      if (fs.existsSync(packageDirectory)) {
        return this.linkPackage(packageDirectory, options);
      }

      try {
        const repoUrl = await this.getRepositoryUrl(packageName);

        await this.cloneRepository(repoUrl, packageDirectory, options);
        await this.installDependencies(packageDirectory, options);
        await this.linkPackage(packageDirectory, options);
      } catch (error) {
        return error; //errors as return values atm
      }
    }
}
