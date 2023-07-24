
const apm = require('./apm-cli');

process.title = 'apm';

(async () => {
  let err = await apm.run(process.argv.slice(2));
  process.exitCode = (err !== null) ? 1 : 0;
  return;
})();
