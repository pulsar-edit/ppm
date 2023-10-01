
const {spawn} = require('child_process');
const path = require('path');
const _ = require('underscore-plus');
const npm = require('npm');
const config = require('./apm');
const fs = require('./fs');

function addPortableGitToEnv(env) {
  const localAppData = env.LOCALAPPDATA;
  if (!localAppData) { return; }

  const githubPath = path.join(localAppData, 'GitHub');

  let children;
  try {
    children = fs.readdirSync(githubPath);
  } catch (error) {
    return;
  }

  for (let child of children) {
    if (child.indexOf('PortableGit_') === 0) {
      const cmdPath = path.join(githubPath, child, 'cmd');
      const binPath = path.join(githubPath, child, 'bin');
      if (env.Path) {
        env.Path += path.delimiter;
      }
      env.Path += `${cmdPath}${path.delimiter}${binPath}`;
      break;
    }
  }

}

function addGitBashToEnv(env) {
  let gitPath;
  if (env.ProgramFiles) {
    gitPath = path.join(env.ProgramFiles, 'Git');
  }

  if (!fs.isDirectorySync(gitPath)) {
    if (env['ProgramFiles(x86)']) {
      gitPath = path.join(env['ProgramFiles(x86)'], 'Git');
    }
  }

  if (!fs.isDirectorySync(gitPath)) { return; }

  const cmdPath = path.join(gitPath, 'cmd');
  const binPath = path.join(gitPath, 'bin');
  if (env.Path) {
    env.Path += path.delimiter;
  }
  env.Path += `${cmdPath}${path.delimiter}${binPath}`;
}

exports.addGitToEnv = env => {
  if (process.platform !== 'win32') { return; }
  addPortableGitToEnv(env);
  addGitBashToEnv(env);
};

exports.getGitVersion = () => {
  const npmOptions = {
    userconfig: config.getUserConfigPath(),
    globalconfig: config.getGlobalConfigPath()
  };
  return new Promise((resolve, _reject) => {
    npm.load(npmOptions, () => {
      const git = npm.config.get('git') ?? 'git';
      exports.addGitToEnv(process.env);
      const spawned = spawn(git, ['--version']);
      const outputChunks = [];
      spawned.stderr.on('data', chunk => void outputChunks.push(chunk));
      spawned.stdout.on('data', chunk => void outputChunks.push(chunk));
      spawned.on('error', () => {});
      spawned.on('close', code => {
        let version;
        if (code === 0) {
          let _gitName, _versionName;
          [_gitName, _versionName, version] = Buffer.concat(outputChunks).toString().split(' ');
          version = version?.trim();
        }
        resolve(version);
      });
    });
  });
};
