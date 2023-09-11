
const apm = require('./apm-cli');

process.title = 'apm';

(async () => {
    await apm.run(process.argv.slice(2)).catch(_error => process.exitCode = 1);
})();
