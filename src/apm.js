const child_process = require('child_process');
const fs = require('./fs');
const path = require('path');
const npm = require('npm');
const semver = require('semver');

let asarPath = null;

module.exports = {
  getHomeDirectory() {
    if (process.platform === 'win32') {
      return process.env.USERPROFILE;
    } else {
      return process.env.HOME;
    }
  },
  getAtomDirectory: () => process.env.ATOM_HOME || path.join(this.getHomeDirectory(), '.pulsar'),
  getRustupHomeDirPath: () => process.env.RUSTUP_HOME || path.join(this.getHomeDirectory(), '.multirust'),
  getCacheDirectory: () => path.join(this.getAtomDirectory(), '.apm'),
  getResourcePath(callback) {
    if (process.env.ATOM_RESOURCE_PATH) {
      return process.nextTick( () => callback(process.env.ATOM_RESOURCE_PATH) );
    }
    if (asarPath) {
      return process.nextTick( () => callback(asarPath) );
    }
    let apmFolder = path.resolve(__dirname, '..');
    let appFolder = path.dirname(apmFolder);
    if (path.basename(apmFolder) === 'apm' && path.basename(appFolder) === 'app') {
      asarPath = appFolder + ".asar";
      if (fs.existsSync(asarPath)) {
        return process.nextTick( () => callback(asarPath) );
      }
    }
    apmFolder = path.resolve(__dirname, '..', '..', '..');
    appFolder = path.dirname(apmFolder);
    if (path.basename(apmFolder) === 'apm' && path.basename(appFolder) === 'app') {
      asarPath = appFolder + ".asar";
      if (fs.existsSync(asarPath)) {
        return process.nextTick( () => callback(asarPath) );
      }
    }
    switch (process.platform) {
      case 'darwin':
        return child_process.exec('mdfind "kMDItemCFBundleIdentifier == \'com.github.atom\'"', (error, stdout, stderr) => {
          let appLocation;
          if (stdout) stdout = '';
          if (!error) {
            appLocation = stdout.split('\n')[0];
          }
          if (!appLocation) {
            appLocation = '/Applications/Atom.app';
          }
          asarPath = appLocation + "/Contents/Resources/app.asar";
          return process.nextTick( () => callback(asarPath) );
        });
      case 'linux':
        asarPath = '/usr/local/share/atom/resources/app.asar';
        if (!fs.existsSync(asarPath)) {
          asarPath = '/usr/share/atom/resources/app.asar';
        }
        return process.nextTick(() => callback(asarPath) );
      case 'win32':
        const glob = require('glob');
        const pattern = "/Users/" + process.env.USERNAME + "/AppData/Local/atom/app-+([0-9]).+([0-9]).+([0-9])/resources/app.asar";
        const asarPaths = glob.sync(pattern, null); // [] | a sorted array of locations with the newest version being last
        asarPath = asarPaths[asarPaths.length - 1];
        return process.nextTick( () => callback(asarPath) );
      default:
        return process.nextTick( () => callback('') );
    }
  },
  getReposDirectory: () =>  process.env.ATOM_REPOS_HOME || path.join(this.getHomeDirectory(), 'github'),
  getElectronUrl: () => process.env.ATOM_ELECTRON_URL || 'https://atom.io/download/electron',
  getAtomPackagesUrl: () => process.env.ATOM_PACKAGES_URL || this.getAtomApiUrl() + "/packages",
  getAtomApiUrl: () => process.env.ATOM_API_URL || 'https://pulsar-edit.com/api',
  getElectronArch() {
    if (process.platform === 'darwin') {
      return 'x64';
    } else {
      return process.env.ATOM_ARCH || process.arch;
    }
  },
  getUserConfigPath: () => path.resolve(this.getAtomDirectory(), '.apmrc'),
  getGlobalConfigPath: () => path.resolve(this.getAtomDirectory(), '.apm', '.apmrc'),
  isWin32: () => process.platform === 'win32',
  x86ProgramFilesDirectory: () => process.env["ProgramFiles(x86)"] || process.env["ProgramFiles"],
  getInstalledVisualStudioFlag() {
    if (!this.isWin32()) {
      return null;
    }
    // Use the explictly-configured version when set
    if (process.env.GYP_MSVS_VERSION) {
      return process.env.GYP_MSVS_VERSION;
    }
    if (this.visualStudioIsInstalled("2019")) {
      return '2019';
    }
    if (this.visualStudioIsInstalled("2017")) {
      return '2017';
    }
    if (this.visualStudioIsInstalled("14.0")) {
      return '2015';
    }
  },
  visualStudioIsInstalled(version) {
    if (version < 2017) {
      return fs.existsSync(path.join(this.x86ProgramFilesDirectory(), "Microsoft Visual Studio " + version, "Common7", "IDE"));
    } else {
      return ["BuildTools","Community","Enterprise","Professional","WDExpress"].some( type =>
        fs.existsSync(path.join(this.x86ProgramFilesDirectory(), "Microsoft Visual Studio", "" + version, type, "Common7", "IDE"))
      );
    }
  },
  loadNpm(callback) {
    const npmOptions = {
      userconfig: this.getUserConfigPath(),
      globalconfig: this.getGlobalConfigPath()
    };
    npm.load(npmOptions, () => callback(null, npm) );
  },
  getSetting: (key, callback) => this.loadNpm( () => callback(npm.config.get(key)) ),
  setupApmRcFile() {
    try {
      return fs.writeFileSync(this.getGlobalConfigPath(), "; This file is auto-generated and should not be edited since any\n; modifications will be lost the next time any apm command is run.\n;\n; You should instead edit your .apmrc config located in ~/.atom/.apmrc\ncache = " + this.getCacheDirectory() + "\n; Hide progress-bar to prevent npm from altering apm console output.\nprogress = false");
    } catch (e) {}
  }
};
