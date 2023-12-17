
const path = require('path');
const url = require('url');

const yargs = require('yargs');
const Git = require('git-utils');
const semver = require('semver');

const fs = require('./fs');
const config = require('./apm');
const Command = require('./command');
const Login = require('./login');
const Packages = require('./packages');
const request = require('./request');

module.exports =
class Publish extends Command {
  static commandNames = [ "publish" ];

    constructor() {
      super();
      this.userConfigPath = config.getUserConfigPath();
      this.atomNpmPath = require.resolve('npm/bin/npm-cli');
    }

    parseOptions(argv) {
      const options = yargs(argv).wrap(Math.min(100, yargs.terminalWidth()));
      options.usage(`\

Usage: ppm publish [<newversion> | major | minor | patch | build]
       ppm publish --tag <tagname>
       ppm publish --rename <new-name>

Publish a new version of the package in the current working directory.

If a new version or version increment is specified, then a new Git tag is
created and the package.json file is updated with that new version before
it is published to the ppm registry. The HEAD branch and the new tag are
pushed up to the remote repository automatically using this option.

If a tag is provided via the --tag flag, it must have the form \`vx.y.z\`.
For example, \`ppm publish -t v1.12.0\`.

If a new name is provided via the --rename flag, the package.json file is
updated with the new name and the package's name is updated.

Run \`ppm featured\` to see all the featured packages or
\`ppm view <packagename>\` to see information about your package after you
have published it.\
`
      );
      options.alias('h', 'help').describe('help', 'Print this usage message');
      options.alias('t', 'tag').string('tag').describe('tag', 'Specify a tag to publish. Must be of the form vx.y.z');
      return options.alias('r', 'rename').string('rename').describe('rename', 'Specify a new name for the package');
    }

    // Create a new version and tag use the `npm version` command.
    //
    // version  - The new version or version increment.
    //
    // return value - A Promise that can reject with an error string
    //                or resolve to the generated tag string.
    versionPackage(version) {
      process.stdout.write('Preparing and tagging a new version ');
      const versionArgs = ['version', version, '-m', 'Prepare v%s release'];
      return new Promise((resolve, reject) => {
        this.fork(this.atomNpmPath, versionArgs, (code, stderr, stdout) => {
          stderr ??= '';
          stdout ??= '';
          if (code === 0) {
            this.logSuccess();
            resolve(stdout.trim());
          } else {
            this.logFailure();
            reject(`${stdout}\n${stderr}`.trim());
          }
        });
      });
    }

    // Push a tag to the remote repository.
    //
    //  tag - The tag to push.
    //  pack - The package metadata.
    //
    //  return value - A Promise that delegates the result of the logCommandResults call.
    pushVersion(tag, pack) {
      process.stdout.write(`Pushing ${tag} tag `);
      const pushArgs = ['push', Packages.getRemote(pack), 'HEAD', tag];
      return new Promise((resolve, reject) => {
        this.spawn('git', pushArgs, (...args) => {
          this.logCommandResults(...args).then(resolve, reject);
        });
      });
    }

    // Check for the tag being available from the GitHub API before notifying
    // the package server about the new version.
    //
    // The tag is checked for 5 times at 1 second intervals.
    //
    // pack - The package metadata.
    // tag - The tag that was pushed.
    //
    // return value - A Promise that resolves (without a value) when either the
    //                number of max retries have been reached or the tag could
    //                actually be retrieved.
    waitForTagToBeAvailable(pack, tag) {
      let retryCount = 5;
      const interval = 1000;
      const requestSettings = {
        url: `https://api.github.com/repos/${Packages.getRepository(pack)}/tags`,
        json: true
      };

      return new Promise((resolve, _reject) => {
        const requestTags = () => {
          request.get(
            requestSettings,
            (_error, response, tags) => {
              tags ??= [];
              if (response?.statusCode === 200) {
                if (tags.some(t => t.name === tag)) {
                  resolve();
                  return;
                }
              }
              if (--retryCount <= 0) {
                return void resolve();
              }
            }
          )
          setTimeout(requestTags, interval);
        };
        requestTags();
      });
    }

    // Does the given package already exist in the registry?
    //
    // packageName - The string package name to check.
    //
    // return value - A Promise that can reject with an error or resolve to
    //                a boolean value.
    async packageExists(packageName) {
      const token = await Login.getTokenOrLogin();
      const requestSettings = {
        url: `${config.getAtomPackagesUrl()}/${packageName}`,
        json: true,
        headers: {
          authorization: token
        }
      };
      return new Promise((resolve, reject) => {
        request.get(requestSettings, (error, response, body) => {
          body ??= {};
          if (error != null) {
            return void reject(error);
          }
          resolve(response.statusCode === 200);
        });
      });
    }

    // Register the current repository with the package registry.
    //
    // pack - The package metadata.
    //
    // return value - A Promise that can reject with various errors (even without a value)
    //                or resolve with true value.
    async registerPackage(pack) {
      if (!pack.name) {
        throw 'Required name field in package.json not found';
      }

      const exists = await this.packageExists(pack.name);
      if (exists) { return Promise.resolve(false); }

      const repository = Packages.getRepository(pack);

      if (!repository) {
        throw 'Unable to parse repository name/owner from package.json repository field';
      }

      process.stdout.write(`Registering ${pack.name} `);

      try {
        const token = await Login.getTokenOrLogin();

        const requestSettings = {
          url: config.getAtomPackagesUrl(),
          json: true,
          qs: {
            repository
          },
          headers: {
            authorization: token
          }
        };
        return new Promise((resolve, reject) => {
          request.post(requestSettings, (error, response, body) => {
            body ??= {};
            if (error != null) {
              return void reject(error);
            }
            if (response.statusCode !== 201) {
              const message = request.getErrorMessage(body, error);
              this.logFailure();
              return void reject(`Registering package in ${repository} repository failed: ${message}`);
            }

            this.logSuccess();
            return resolve(true);
          });
        });
      } catch (error) {
        this.logFailure();
        throw error;
      }
    }

    // Create a new package version at the given Git tag.
    //
    // packageName - The string name of the package.
    // tag - The string Git tag of the new version.
    //
    // return value - A Promise that rejects with an error or resolves without a value.
    async createPackageVersion(packageName, tag, options) {
      const token = await Login.getTokenOrLogin();
      const requestSettings = {
        url: `${config.getAtomPackagesUrl()}/${packageName}/versions`,
        json: true,
        qs: {
          tag,
          rename: options.rename
        },
        headers: {
          authorization: token
        }
      };
      return new Promise((resolve, reject) => {
        request.post(requestSettings, (error, response, body) => {
          body ??= {};
          if (error != null) {
            return void reject(error);
          }
          if (response.statusCode !== 201) {
            const message = request.getErrorMessage(body, error);
            return void reject(`Creating new version failed: ${message}`);
          }

          resolve();
        });
      });
    }

    // Publish the version of the package associated with the given tag.
    //
    // pack - The package metadata.
    // tag - The Git tag string of the package version to publish.
    // options - An options Object (optional).
    //
    // return value - A Promise that rejects with an error or resolves without a value.
    async publishPackage(pack, tag, options) {
      options ??= {};

      process.stdout.write(`Publishing ${options.rename || pack.name}@${tag} `);
      try {
        await this.createPackageVersion(pack.name, tag, options);
      } catch (error) {
        this.logFailure();
        throw error;
      }

      this.logSuccess();
    }

    logFirstTimePublishMessage(pack) {
      process.stdout.write('Congrats on publishing a new package!'.rainbow);
      // :+1: :package: :tada: when available
      if (process.platform === 'darwin') {
        process.stdout.write(' \uD83D\uDC4D  \uD83D\uDCE6  \uD83C\uDF89');
      }

      process.stdout.write(`\nCheck it out at https://web.pulsar-edit.dev/packages/${pack.name}\n`);
    }

    loadMetadata() {
      const metadataPath = path.resolve('package.json');
      if (!fs.isFileSync(metadataPath)) {
        throw new Error(`No package.json file found at ${process.cwd()}/package.json`);
      }

      try {
        return JSON.parse(fs.readFileSync(metadataPath));
      } catch (error) {
        throw new Error(`Error parsing package.json file: ${error.message}`);
      }
    }

    saveMetadata(pack) {
      const metadataPath = path.resolve('package.json');
      const metadataJson = JSON.stringify(pack, null, 2);
      fs.writeFileSync(metadataPath, `${metadataJson}\n`);
    }

    loadRepository() {
      let currentBranch, remoteName, upstreamUrl;
      const currentDirectory = process.cwd();

      const repo = Git.open(currentDirectory);
      if (!(repo != null ? repo.isWorkingDirectory(currentDirectory) : undefined)) {
        throw new Error('Package must be in a Git repository before publishing: https://help.github.com/articles/create-a-repo');
      }


      if (currentBranch = repo.getShortHead()) {
        remoteName = repo.getConfigValue(`branch.${currentBranch}.remote`);
      }
      if (remoteName == null) { remoteName = repo.getConfigValue('branch.master.remote'); }

      if (remoteName) { upstreamUrl = repo.getConfigValue(`remote.${remoteName}.url`); }
      if (upstreamUrl == null) { upstreamUrl = repo.getConfigValue('remote.origin.url'); }

      if (!upstreamUrl) {
        throw new Error('Package must be pushed up to GitHub before publishing: https://help.github.com/articles/create-a-repo');
      }
    }

    // Rename package if necessary
    async renamePackage(pack, name) {
      if ((name ?? '').length <= 0) {
        // Just fall through if the name is empty
        return; // error or return value?
      }
      if (pack.name === name) { throw 'The new package name must be different than the name in the package.json file'; }

      const message = `Renaming ${pack.name} to ${name} `;
      process.stdout.write(message);
      try {
        this.setPackageName(pack, name);
      } catch (error) {
        this.logFailure();
        throw error;
      }

      const gitCommand = await config.getSetting('git') ?? 'git';
      return new Promise((resolve, reject) => {
        this.spawn(gitCommand, ['add', 'package.json'], (code, stderr, stdout) => {
          stderr ??= '';
          stdout ??= '';
          if (code !== 0) {
            this.logFailure();
            const addOutput = `${stdout}\n${stderr}`.trim();
            return void reject(`\`git add package.json\` failed: ${addOutput}`);
          }

          this.spawn(gitCommand, ['commit', '-m', message], (code, stderr, stdout) => {
            stderr ??= '';
            stdout ??= '';
            if (code === 0) {
              this.logFailure();
              const commitOutput = `${stdout}\n${stderr}`.trim();
              reject(`Failed to commit package.json: ${commitOutput}`);
              return;
            }

            this.logSuccess();
            resolve();
          });
        });
      });
    }

    setPackageName(pack, name) {
      pack.name = name;
      this.saveMetadata(pack);
    }

    validateSemverRanges(pack) {
      let packageName, semverRange;
      if (!pack) { return; }

      const isValidRange = function (semverRange) {
        if (semver.validRange(semverRange)) { return true; }

        try {
          if (url.parse(semverRange).protocol.length > 0) { return true; }
        } catch (error) {}

        return semverRange === 'latest';
      };

      const range = pack.engines?.pulsar ?? pack.engines?.atom ?? undefined;
      if (range != null) {
        if (!semver.validRange(range)) {
          throw new Error(`The Pulsar or Atom engine range in the package.json file is invalid: ${range}`);
        }
      }

      for (packageName in pack.dependencies) {
        semverRange = pack.dependencies[packageName];
        if (!isValidRange(semverRange)) {
          throw new Error(`The ${packageName} dependency range in the package.json file is invalid: ${semverRange}`);
        }
      }

      for (packageName in pack.devDependencies) {
        semverRange = pack.devDependencies[packageName];
        if (!isValidRange(semverRange)) {
          throw new Error(`The ${packageName} dev dependency range in the package.json file is invalid: ${semverRange}`);
        }
      }

    }

    // Run the publish command with the given options
    async run(options) {
      let pack;
      options = this.parseOptions(options.commandArgs);
      let {tag, rename} = options.argv;
      let [version] = options.argv._;

      try {
        pack = this.loadMetadata();
      } catch (error) {
        return error;
      }

      try {
        this.validateSemverRanges(pack);
      } catch (error) {
        return error;
      }

      try {
        this.loadRepository();
      } catch (error) {
        return error;
      }

      if ((version?.length > 0) || (rename?.length > 0)) {
        let originalName;
        if (version?.length <= 0) { version = 'patch'; }
        if (rename?.length > 0) { originalName = pack.name; }

        let firstTimePublishing;
        let tag;
        try {
          firstTimePublishing = await this.registerPackage(pack);
          await this.renamePackage(pack, rename);
          tag = await this.versionPackage(version);
          await this.pushVersion(tag, pack);
        } catch (error) {
          return error;
        }

        await this.waitForTagToBeAvailable(pack, tag);
        if (originalName != null) {
          // If we're renaming a package, we have to hit the API with the
          // current name, not the new one, or it will 404.
          rename = pack.name;
          pack.name = originalName;
        }

        try {
          await this.publishPackage(pack, tag, {rename});
        } catch (error) {
          if (firstTimePublishing) {
            this.logFirstTimePublishMessage(pack);
          }
          return error;
        }
      } else if (tag?.length > 0) {
        let firstTimePublishing;
        try {
          firstTimePublishing = await this.registerPackage(pack);
        } catch (error) {
          return error;
        }

        try {
          await this.publishPackage(pack, tag);
        } catch (error) {
          if (firstTimePublishing) {
            this.logFirstTimePublishMessage(pack);
          }
          return error;
        }
      } else {
        return 'A version, tag, or new package name is required';
      }
    }
  }
