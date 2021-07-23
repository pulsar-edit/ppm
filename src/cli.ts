/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import { run } from "./apm-cli"

process.title = "apm"

run(process.argv.slice(2), (error) => (process.exitCode = error != null ? 1 : 0))
