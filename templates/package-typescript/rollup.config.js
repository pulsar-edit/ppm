import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import json from '@rollup/plugin-json';
import typescript from '@rollup/plugin-typescript';

// This is a preset Rollup configuration file designed for Pulsar community
// packages written in TypeScript. Here's what it gives us:
//
// * All dependencies that use CommonJS are preserved as-is.
// * All dependencies that use ES Modules are bundled and transpiled to
//   CommonJS. (This is necessary because it is impossible for ESM files loaded
//   in Electron's renderer process to have access to anything from a Node
//   environment, whether built-in or NPM.)
// * JSON files can be imported directly with `import` syntax and do not need
//   the "import attribute" clause. This corresponds to CommonJS's ability to
//   `require('foo.json')`.
//
// Read https://www.electronjs.org/docs/latest/tutorial/esm#renderer-process
// for more information about the limitations of ESM in Electron's renderer
// process.
//
// Known caveats:
//
// * Not all ESM can be transpiled to CommonJS. If your module uses top-level
//   `await` or does dynamic importing (via `await import`), Rollup might be
//   unable to transpile it. If so, you'll have to find a workaround or use a
//   different dependency.
//
//   One possible workaround is reverting to an older version of the same
//   dependency. Many popular packages that use newer ES features will have an
//   older version that doesn't rely on those features, and perhaps an even
//   older version that is written in CommonJS.
//
// * We have been unable to find a combination of plugins that makes it
//   possible to use SolidJS (with JSX) in a TypeScript project while also
//   satisfying the constraints above. (See
//   https://docs.solidjs.com/configuration/typescript for more information.)
//   We have managed to make this work for the equivalent toolchain in
//   JavaScript, but the addition of TypeScript seems to complicate things
//   further. Feel free to customize what's here and let us know if you find a
//   configuration that works.
//
export default {
  input: 'src/index.ts',
  output: {
    file: 'lib/index.cjs',
    // Output CommonJS as required by Electron in renderer code.
    format: 'cjs',
    exports: 'auto',
    interop: 'auto',
    sourcemap: true
  },
  plugins: [
    resolve({
      extensions: ['.js', '.ts', '.json'],
      // Look in `node_modules` for dependencies.
      preferBuiltins: true,
      // Prefer the `main` field to the `module` field in `package.json`; this
      // means that, when a package offers both CommonJS and ESM versions of
      // itself, we'll prefer the CJS so that transpilation can be avoided.
      mainFields: ['main', 'module']
    }),
    commonjs({
      // Transpile everything, even things in `node_modules`.
      include: /node_modules/,
      // Enable transformations of ES modules in `node_modules`.
      transformMixedEsModules: true,
      // Handle requiring of JSON files.
      ignoreDynamicRequires: false
    }),
    typescript({
      tsconfig: './tsconfig.json',
      sourceMap: true
    }),
    // Allows requiring of JSON files directly.
    json()
  ],
  // Mark certain packages as external; this tells Rollup not to try to
  // transpile the code in these packages. You may opt into this for any
  // dependency that exports a CommonJS version.
  //
  // `atom` _must_ be present in this list because imports from `atom` will be
  // resolved at runtime.
  external: [
    'atom'
  ]
}
