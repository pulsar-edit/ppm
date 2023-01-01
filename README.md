# ppm - Pulsar Package Manager

Discover and install Pulsar packages powered by [pulsar-edit.dev](https://web.pulsar-edit.dev).

ppm is bundled with the `pulsar` binaries so any ppm command can also be run with `pulsar -p` or `pulsar --package`.

You can configure ppm by using the `ppm config` command line option (recommended) or by manually editing the `~/.pulsar/.apmrc` file as per the [npm config](https://docs.npmjs.com/misc/config).

## Relation to npm

ppm bundles [npm](https://github.com/npm/npm) with it and spawns `npm` processes to install Pulsar packages. The major difference is that `ppm` sets multiple command line arguments to `npm` to ensure that native modules are built against Chromium's v8 headers instead of node's v8 headers.

The other major difference is that Pulasr packages are installed to `~/.pulsar/packages` instead of a local `node_modules` folder and Pulsar packages are published to and installed from GitHub repositories instead of [npmjs.com](https://www.npmjs.com/)

Therefore you can think of `ppm` as a simple `npm` wrapper that builds on top of the many strengths of `npm` but is customized and optimized to be used for Pulsar packages.

## Installing

`ppm` is bundled and installed automatically with Pulsar. You can run the _Pulsar > Install Shell Commands_ menu option to install it again if you aren't able to run it from a terminal (macOS only).

## Building

  * Clone the repository
  * :penguin: Install `libsecret-1-dev` (or the relevant `libsecret` development dependency) if you are on Linux
  * Run `npm install`; this will install the dependencies with your built-in version of Node/npm, and then rebuild them with the bundled versions.
  * Run `./bin/npm run build` to compile the CoffeeScript code (or `.\bin\npm.cmd run build` on Windows)
  * Run `./bin/npm test` to run the specs (or `.\bin\npm.cmd test` on Windows)

### Why `bin/npm` / `bin\npm.cmd`?

`ppm` includes `npm`, and spawns it for various processes. It also comes with a bundled version of Node, and this script ensures that npm uses the right version of Node for things like running the tests. If you're using the same version of Node as is listed in `BUNDLED_NODE_VERSION`, you can skip using this script.

## Using

Run `ppm help` to see all the supported commands and `ppm help <command>` to
learn more about a specific command.

The common commands are `ppm install <package_name>` to install a new package,
`ppm featured` to see all the featured packages, and `ppm publish` to publish
a package to [pulsar-edit.dev](https://web.pulsar-edit.dev).

## Two-factor authentication?

If you have 2fa enabled on your GitHub account, you'll need to generate a [personal access token](https://help.github.com/articles/creating-a-personal-access-token-for-the-command-line/) and provide that when prompted for your password.

## Behind a firewall?

If you are behind a firewall and seeing SSL errors when installing packages
you can disable strict SSL by running:

```
ppm config set strict-ssl false
```

## Using a proxy?

If you are using a HTTP(S) proxy you can configure `ppm` to use it by running:

```
ppm config set https-proxy https://9.0.2.1:0
```

You can run `ppm config get https-proxy` to verify it has been set correctly.

## Viewing configuration

You can also run `ppm config list` to see all the custom config settings.
