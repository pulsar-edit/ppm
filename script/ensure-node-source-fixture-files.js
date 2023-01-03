const fs = require("fs");
const path = require("path");
const https = require("https");

// This "nodeVersion" specifies the version of Node or Electron built against
// during certain specs. Update nodeVersion in this JSON file to run those specs
// against a different version of Node's or Electron's source files.
// This value is also used in those spec files, via this same json file.
// (Note: We may need to update this to work around build issues encountered
// when updating Node bundled with ppm.)
// (Note: This should ideally match Pulsar's current Electron version.)
// (Note: Electron forks (and mildly modifies) Node for inclusion in Electron.)
const nodeVersion = require("../spec/config.json").nodeVersion;

// This "distUrl" can be any Node.JS or Electron distribution mirror on the web,
// such as "https://nodejs.org/dist",
// or "https://artifacts.electronjs.org/headers/dist"...
// but it should probably be the official Electron dist URL, so we can test
// building dummy spec packages against the Electron version Pulsar uses.
const distUrl = "https://artifacts.electronjs.org/headers/dist";

// Important note: If you update the above `nodeVersion` to a different version,
// remember to calculate the new sha256sums and update them in the array below.
// Instructions:
//   Delete any old files under "spec/fixtures/node-source",
//   update `nodeVersion` to the desired version number above,
//   re-run this script so it will download the new files,
//   then calculate the SHA256SUMS of the updated files, like so:
//     on Linux/macOS: `shasum -a 256 spec/fixtures/node-source/*`
//     in Windows cmd: `for /r "spec\fixtures\node-source" %i in (*) do CertUtil -hashfile %i SHA256`
//     in Windows PowerShell: `Get-FileHash -Algorithm SHA256 "spec\fixtures\node-source\*" | Format-List`
//   And finally copy-paste the updated SHA256 hash values into the array below.
const filesToFetch = [
  {
    url: `${distUrl}/${nodeVersion}/node-${nodeVersion}-headers.tar.gz`,
    filename: `node-${nodeVersion}-headers.tar.gz`,
    sha256sum: "092a039e403f758f542a0f801acac8604e2d7a9b63d8f3c8c31df71c7ba8aac5"
  },
  {
    url: `${distUrl}/${nodeVersion}/node-${nodeVersion}.tar.gz`,
    filename: `node-${nodeVersion}.tar.gz`,
    sha256sum: "092a039e403f758f542a0f801acac8604e2d7a9b63d8f3c8c31df71c7ba8aac5"
  },
  {
    url: `${distUrl}/${nodeVersion}/win-x86/node.lib`,
    filename: "node.lib",
    sha256sum: "4c59ee4f9b78dfdd904cc211080acbbc485104d467c29df24bf45c4017ef638e"
  },
  {
    url: `${distUrl}/${nodeVersion}/win-x64/node.lib`,
    filename: "node_x64.lib",
    sha256sum: "248a81dd4d5cdaf8c0497a4f6c6855c1e2db3e0439757bfed4f2c1e3c530d04e"
  },
  {
    url: `${distUrl}/${nodeVersion}/SHASUMS256.txt`,
    filename: "SHASUMS256.txt",
    sha256sum: "8ceda90dbb1f65b9c1ca73321949c3ec6ed81f20f49215535d537164612930a7"
  },
];

const sourceFixtureDir = path.resolve(__dirname, "..", "spec", "fixtures", "node-source");
fs.mkdirSync(sourceFixtureDir, { recursive: true });

for (const details of filesToFetch) {
  ensureFile(details);
} // This is the main loop, with support functions below.

async function ensureFile(details) {
  // We check if the file already exists, and if so,
  // make sure its sha256sum matches the expected/correct value.
  // If it doesn't exist or has the wrong hash, try to re-download.

  logVerbose("details is:");
  logVerbose(details);

  const destinationPath = path.resolve(sourceFixtureDir, details.filename);
  logVerbose(`destinationPath is: ${destinationPath}`);

  const existingFileIsCorrect = await verifyExistingFile(destinationPath, details.sha256sum);

  if (!existingFileIsCorrect) {
    logVerbose("Hash did not match, re-downloading...");
    // Get the file
    downloadFileToDestination(details.url, destinationPath)
      .then(async function () {
        console.log(`Successfully downloaded file from ${details.url}.`);
        logVerbose("checking if hash matches in for...of loop.");
        // Check its hash
        const hashDidMatch = await verifyHash(destinationPath, details.sha256sum);
        if (!hashDidMatch) {
          console.error(`Hash did not match for ${destinationPath}`);
        }
      })
      .catch(console.error);
  }
}

async function verifyExistingFile(targetPath, expectedHash) {
  if (fs.existsSync(targetPath)) {
    logVerbose(`${targetPath} already exists.`);

    logVerbose(`verifying hash for ${targetPath} in verifyExistingFile`);
    const hashDidMatch = await verifyHash(targetPath, expectedHash);

    if (hashDidMatch) {
      // Successfully verified existing file. Return true.
      console.log(`Existing file ${targetPath} successfully verified.`);
      return true;
    } else {
      // Existing file's hash was wrong. Delete the old file.
      console.error(`Hash did not match for ${targetPath}. Deleting.`);
      fs.rmSync(targetPath);
    }
  } else {
    // File did not actually exist.
    logVerbose(`${targetPath} does not exist.`);
  }
  // If we haven't returned yet, verification did not succeed. Return false.
  return false;
}

async function verifyHash(path, expectedHash) {
  // Checks the hash of a given locally downloaded file against its expected value.
  // Returns true/false.
  // See: https://nodejs.org/api/crypto.html#class-hash for details.

  // This module apparently needs to be required each time this function runs,
  // or hashing multiple files in parallel can get messed up? Not sure why.
  const { createHash } = require("node:crypto");

  const hash = createHash("sha256");
  hash.update(fs.readFileSync(path));
  const actualHash = hash.digest("hex");
  hash.end();
  // The hash of the actual file on disk.

  logVerbose(`expectedHash is: ${expectedHash}`);
  logVerbose(`actualHash is: ${actualHash}`);
  // The expected hash is from the array of objects at the top of the file.

  if (actualHash === expectedHash) {
    logVerbose("Hash verified successfully");
    return true;
  } else {
    logVerbose("Hash did not match");
    return false;
  }
}

function downloadFileToDestination(url, filePath) {
  // Actually downloads the desired file to disk.
  // Returns a Promise.
  // Based on https://scrapingant.com/blog/download-image-javascript

  logVerbose(`Downloading ${url} to ${filePath}`);

  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      // Technically any 2XX series HTTP response code means success,
      // but in practice this should always be exactly "200"? Adjust if needed.
      if (res.statusCode === 200) {
        res.pipe(fs.createWriteStream(filePath))
          .on("error", reject)
          .once("close", resolve);
      } else {
        // Consume response data to free up memory
        res.resume();
        reject(new Error(`Request Failed With a Status Code: ${res.statusCode} for ${url}`));
      }
    });
  });
}

function logVerbose(message) {
  // Logs a bunch of verbose information, for debugging purposes.
  // Run this script with "--verbose" to help troubleshoot issues.

  // Note: Lots of stuff in this script is async and will print out-of-order.
  // For example: Smaller files will finish downloading first,
  // and their post-download log messages will print in the middle of other stuff.
  if (process.argv.includes("--verbose")) {
    console.log(message);
  }
}
