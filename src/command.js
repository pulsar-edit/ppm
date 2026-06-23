
const child_process = require('child_process');
const path = require('path');
const semver = require('semver');
const config = require('./apm');
const git = require('./git');

module.exports =
class Command {

  spawn(command, args, optionsOrCallback, callbackOrMissing) {
    const [callback, options] = callbackOrMissing == null
      ? [optionsOrCallback]
      : [callbackOrMissing, optionsOrCallback];

    const spawned = child_process.spawn(command, args, options);

    const errorChunks = [];
    const outputChunks = [];

    spawned.stdout.on('data', chunk => {
      if (options?.streaming) {
        process.stdout.write(chunk);
      } else {
        outputChunks.push(chunk);
      }
    });

    spawned.stderr.on('data', chunk => {
      if (options?.streaming) {
        process.stderr.write(chunk);
      } else {
        errorChunks.push(chunk);
      }
    });

    const onChildExit = errorOrExitCode => {
      spawned.removeListener('error', onChildExit);
      spawned.removeListener('close', onChildExit);
      return (typeof callback === 'function' ? callback(errorOrExitCode, Buffer.concat(errorChunks).toString(), Buffer.concat(outputChunks).toString()) : undefined);
    };

    spawned.on('error', onChildExit);
    spawned.on('close', onChildExit);

    return spawned;
  }

  fork(script, args, ...remaining) {
    return this.spawn(process.execPath, [script, ...args], ...remaining);
  }

  packageNamesFromArgv(argv) {
    return this.sanitizePackageNames(argv._);
  }

  sanitizePackageNames(packageNames) {
    packageNames ??= [];
    packageNames = packageNames.map(packageName => packageName.trim());
    return Array.from(new Set(packageNames)).filter(Boolean); // Array of only unique truthy values
  }

  logSuccess() {
    process.stdout.write((process.platform === 'win32' ? 'done\n' : '\u2713\n').green);
  }

  logFailure() {
    process.stdout.write((process.platform === 'win32' ? 'failed\n' : '\u2717\n').red);
  }

  async logCommandResults(code, stderr, stdout) {
    stderr ??= '';
    stdout ??= '';
    if (code !== 0) {
      this.logFailure();
      throw `${stdout}\n${stderr}`.trim();
    }

    this.logSuccess();
  }

  async logCommandResultsIfFail(code, stderr, stdout) {
    stderr ??= '';
    stdout ??= '';
    if (code !== 0) {
      this.logFailure();
      throw `${stdout}\n${stderr}`.trim();
    }
  }

  normalizeVersion(version) {
    if (typeof version === 'string') {
      // Remove commit SHA suffix
      return version.replace(/-.*$/, '');
    } else {
      return version;
    }
  }

  async loadInstalledAtomMetadata() {
    const resourcePath = await this.getResourcePath();
    let electronVersion;
    try {
      let version;
      ({ version, electronVersion } = require(path.join(resourcePath, "package.json")) ?? {});
      version = this.normalizeVersion(version);
      if (semver.valid(version)) { this.installedAtomVersion = version; }
    } catch (error) {}

    this.electronVersion = process.env.ATOM_ELECTRON_VERSION ?? electronVersion;
    if (this.electronVersion == null) {
      throw new Error('Could not determine Electron version');
    }
  }

  getResourcePath() {
    return new Promise((resolve, _reject) => {
      if (this.resourcePath) {
        process.nextTick(() => void resolve(this.resourcePath));
      } else {
        config.getResourcePath().then(resourcePath => { this.resourcePath = resourcePath; resolve(this.resourcePath); });
      }
    });
  }

  addBuildEnvVars(env) {
    if (config.isWin32()) { this.updateWindowsEnv(env); }
    this.addNodeBinToEnv(env);
    this.addProxyToEnv(env);
    env.npm_config_runtime = "electron";
    env.npm_config_target = this.electronVersion;
    env.npm_config_disturl = config.getElectronUrl();
    env.npm_config_arch = config.getElectronArch();
    env.npm_config_target_arch = config.getElectronArch(); // for node-pre-gyp
  }

  getNpmBuildFlags() {
    // We used to set `--force-process-config=true` here, but we've upgraded
    // Electron past the point where that's needed. For more details, see:
    // https://github.com/nodejs/node-gyp/pull/2497.
    return [`--target=${this.electronVersion}`, `--disturl=${config.getElectronUrl()}`, `--arch=${config.getElectronArch()}`];
  }

  updateWindowsEnv(env) {
    env.USERPROFILE = env.HOME;

    git.addGitToEnv(env);
  }

  addNodeBinToEnv(env) {
    const nodeBinFolder = path.resolve(__dirname, '..', 'bin');
    const pathKey = config.isWin32() ? 'Path' : 'PATH';
    env[pathKey] = env[pathKey] ? `${nodeBinFolder}${path.delimiter}${env[pathKey]}` : nodeBinFolder;
  }

  addProxyToEnv(env) {
    const httpProxy = this.npm.config.get('proxy');
    if (httpProxy) {
      env.HTTP_PROXY ??= httpProxy;
      env.http_proxy ??= httpProxy;
    }

    const httpsProxy = this.npm.config.get('https-proxy');
    if (httpsProxy) {
      env.HTTPS_PROXY ??= httpsProxy;
      env.https_proxy ??= httpsProxy;

      // node-gyp only checks HTTP_PROXY (as of node-gyp@4.0.0)
      env.HTTP_PROXY ??= httpsProxy;
      env.http_proxy ??= httpsProxy;
    }

    // node-gyp doesn't currently have an option for this so just set the
    // environment variable to bypass strict SSL
    // https://github.com/nodejs/node-gyp/issues/448
    const useStrictSsl = this.npm.config.get("strict-ssl") ?? true;
    if (!useStrictSsl) { env.NODE_TLS_REJECT_UNAUTHORIZED = 0; }
  }
};
