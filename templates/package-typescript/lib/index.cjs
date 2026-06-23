const description = `After installing your dependencies with \`npm install\`, you must run \`npm run build\` or \`npm run watch\` from the root in order to compile your TypeScript project into JavaScript — at which point you will no longer see this warning.

If you're stuck, follow the directions in your new package's \`README.md\`.
`;

exports.activate = () => {
  atom.notifications.addWarning(
    '__package-name__ is created but not built',
    { description, dismissable: true }
  );
};
