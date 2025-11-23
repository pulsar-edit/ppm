# __package-name__ package

A short description of your package.

![A screenshot of your package](https://f.cloud.github.com/assets/69169/2290250/c35d867a-a017-11e3-86be-cd7c5bf3ff9b.gif)

## Package authors

If you’ve just generated this package, here’s how to proceed:

1. `npm install` will install the packages necessary for the build toolchain.
2. `npm run watch` can be used during development; it will automatically recompile when files change.
3. Specs run in JavaScript and should import the package (if necessary) from `../lib/index` rather than `../src/index`.
4. `npm run build` can perform a build and should be run for safety’s sake before publishing. When you make changes, make sure you commit both the source files in `src` and the generated files in `lib`.

Other tasks to perform before publishing:

- [ ] Create a corresponding repository on GitHub and push your code to that location.
- [ ] Add specs in the `spec` folder and ensure they pass.
- [ ] Update the `LICENSE` and `CHANGELOG` files.
- [ ] Edit `package.json` to…
  - [ ] …change the URL of the `repository` to match the GitHub repo you created.
  - [ ] …add keywords.
  - [ ] …write an accurate `description`.
  - [ ] …change or remove the `activationCommands` field.
- [ ] Edit the `README` to add detail about your package — and to remove this instructional text!
