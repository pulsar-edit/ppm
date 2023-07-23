
const apm = require('./apm-cli');

process.title = 'apm';

apm.run(process.argv.slice(2), error => process.exitCode = (error != null) ? 1 : 0);
