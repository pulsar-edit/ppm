# papm

Performant Atom Package Manager

![Build Status (Github Actions)](https://github.com/atom-community/papm/workflows/CI/badge.svg)
[![Dependency Status](https://david-dm.org/atom-community/papm.svg)](https://david-dm.org/atom-community/papm)
[![apm](https://img.shields.io/apm/dm/papm.svg)](https://github.com/atom-community/papm)
[![apm](https://img.shields.io/apm/v/papm.svg)](https://github.com/atom-community/papm)

# Roadmap

## Implementation Requirements (Future Features)

- `papm` shall use `pnpm`
- `papm` shall not use GitHub tags for publishing (See [this](https://github.com/atom/apm/issues/919) for the background)
- `papm` shall either publish the atom packages to a `npm` registry, or use GitHub packages
- `papm` shall be able to install the packages that are published on the old registry (backward compatibility)
- `papm` operations shall not block the UI
- `papm` shall handle failed installations, bad connections, etc.

## Strategy

The strategy I suggest is to:

- decaffeinate each file using https://decaffeinate-project.org/
- replace the old dependencies of the resulting code with modern replacements
- replace npm things with pnpm

https://github.com/atom-community/apm/tree/master/src

In the end, we can think about publishing on the `npm` registry or using Github packages
