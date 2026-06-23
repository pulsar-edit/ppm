// Run this script to make the fixtures in `spec/fixtures/node-dist` match the
// Electron version you're targeting.
//
// This is a bit tricky because we expect `BUNDLED_NODE_VERSION` to refer to
// the version of Node, but `spec/config.json` to refer to the version of
// Electron associated with that version of Node. We could actually just use
// Node version numbers throughout — and get these artifacts from the Node
// folks instead of the Electron folks — but the Electron artifacts are much
// smaller, so it's nicer to Git.

const path = require('path');
const fs = require('fs');
const { pipeline } = require('stream/promises');

let targetedElectronVersion = process.argv[2];
if (!targetedElectronVersion.startsWith('v')) {
  targetedElectronVersion = `v${targetedElectronVersion}`;
}

console.log('Targeted Electron version is', targetedElectronVersion);

const FILES = [
  {
    path: 'SHASUMS256.txt'
  },
  {
    path: 'win-x86/node.lib',
    name: 'node.lib'
  },
  {
    path: 'win-x64/node.lib',
    name: 'node_x64.lib'
  },
  {
    path(version) {
      return `node-${version}-headers.tar.gz`
    }
  }
];

async function downloadFile (downloadUrl, destinationPath) {
  let response = await fetch(downloadUrl);

  if (!response.ok) {
    throw new Error(`Failed to download file at: ${downloadUrl}`);
  }

  await pipeline(
    response.body,
    fs.createWriteStream(destinationPath)
  );
}

let baseUrl = `https://artifacts.electronjs.org/headers/dist/${targetedElectronVersion}/`

const fixturesPath = path.resolve(__dirname, '..', 'spec', 'fixtures', 'node-dist');
const specConfigPath = path.resolve(__dirname, '..', 'spec', 'config.json');

async function run () {
  for (let f of FILES) {
    let fileUrl = typeof f.path === 'function' ? f.path(targetedElectronVersion) : f.path;
    let fullUrl = `${baseUrl}${fileUrl}`;
    let destinationSegment = f.name ?? fileUrl;
    console.log(`Downloading from`, fullUrl, 'to', destinationSegment, '…');
    await downloadFile(
      fullUrl,
      path.resolve(fixturesPath, destinationSegment)
    );
  }

  console.log('Updating the version in spec/config.json…');
  let configObj = JSON.parse(fs.readFileSync(specConfigPath));
  configObj.nodeVersion = targetedElectronVersion;
  fs.writeFileSync(specConfigPath, JSON.stringify(configObj, null, 2));
}

const SUCCESS_MESSAGE = `
Success!

IMPORTANT: Please remember to delete

  spec/fixtures/node-dist/node-vX.Y.Z-headers.tar.gz

where X.Y.Z is the version of Electron we just moved away from.
`;

run().then(() => console.log(SUCCESS_MESSAGE));
