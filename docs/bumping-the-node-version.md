# Bumping Node

Ideally, the version of Node used by `ppm` should be kept in sync with the version of Node used by the Electron version of the corresponding release of Pulsar.

For example: at time of writing, Pulsar uses Electron 30.0.9, which corresponds to Node 20.11.1. So `ppm` should also point to Node 20.11.1.

You should know **both** the Node version **and** the Electron version you’re targeting before you begin; you’ll use both values.

Here’s how it works:

## Run the specs

**Before you change anything**, run `bin/npm test` and ensure the test suite is green. If it isn’t, don’t proceed — unless you have reason to believe that the Node upgrade itself is what will fix the failing specs.

## Change `BUNDLED_NODE_VERSION`

The contents of this file govern which version of Node is downloaded when `ppm` is installed. Make sure this corresponds to the new **Node** version that `ppm` will use, since this will be downloaded directly from the Node servers when `ppm` is built.


## Change the fixture files

The `spec/fixtures/node-dist` directory contains files that are needed for specs that test `ppm`’s ability to compile dependencies with native modules.

We use _Electron’s_ artifacts here because they’re smaller than Node’s. So even though we used the Node version number above, we’ll need `spec/config.json` to point to the corresponding Electron version number, not the Node version number!

Luckily, there’s a script to automate all of this. From the project root, and assuming you want to grab the artifacts for Electron 30.5.1, run:

```sh
node ./scripts/update-spec-fixtures.js 30.5.1
```

This will construct the correct URLs, download these files to `spec/fixtures/node-dist` under the names that the specs expect, and finally update `spec/config.json` once the downloads are finished.

As the script reminds you, you should also delete the `.tar.gz` file inside `spec/fixtures/node-dist` corresponding to the previous Electron version.

## Run the specs

Now that you’ve bumped the Node version, run `bin/npm test` to ensure all the specs pass. If they fail now, then the failure has something to do with the Node upgrade — because we made sure the tests passed before we started. Don’t land the Node upgrade until CI is happy!
