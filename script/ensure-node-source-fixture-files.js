const fs = require("fs");
const path = require("path");
const https = require("https");

// This "nodeVersion" specifies the version of Node used by certain specs.
// Update nodeVersion here to run those specs against newer Node source files.
// (May be needed to work around build issues with newer Node bundled with ppm.)
// This string is also hard-coded in those spec files, so update it there, too.
const nodeVersion = "v18.12.1";

const filesToFetch = [
  {
    url: `https://nodejs.org/dist/${nodeVersion}/node-${nodeVersion}.tar.gz`,
    filename: `node-${nodeVersion}.tar.gz`,
    sha256sum: "ba8174dda00d5b90943f37c6a180a1d37c861d91e04a4cb38dc1c0c74981c186"
  },
  {
    url: `https://nodejs.org/dist/${nodeVersion}/node-${nodeVersion}-headers.tar.gz`,
    filename: `node-${nodeVersion}-headers.tar.gz`,
    sha256sum: "9d55ee072ba6d5a141db092cef1a0f715f7d3fc938285a6d927a1d0a0c7442f7"
  },
  {
    url: `https://nodejs.org/dist/${nodeVersion}/win-x64/node.lib`,
    filename: "node_x64.lib",
    sha256sum: "1bd376a23d181d85096d1a9c46e6be7fcd20d30f9b8f77a2a847d3dbff8e25c7"
  },
  {
    url: `https://nodejs.org/dist/${nodeVersion}/win-x86/node.lib`,
    filename: "node.lib",
    sha256sum: "b1c6dc670911d85ef1704fa56f4cc4c7e1071f4869778398e6d88b3b0b565978"
  },
  {
    url: `https://nodejs.org/dist/${nodeVersion}/SHASUMS256.txt`,
    filename: "SHASUMS256.txt",
    sha256sum: "64aad1211a6003dd6529ebf9f19167769d0356ce5affc4245bb26c35aa66a9ed"
  },
]; // If you ever need to update to a newer Node version, just calculate the sha256sums
   // for the new files and update them here to match the new files.

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
        reject(new Error(`Request Failed With a Status Code: ${res.statusCode}`));
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
