const { DownloaderHelper } = require("node-downloader-helper")
const gitly = require("gitly").default
const { join, dirname } = require("path")

const downloadFolder = join(dirname(__dirname), "spec", "fixtures")

const downloadOptions = {
  override: { skip: true },
}
const links = [
  "https://github.com/atom-community/apm/raw/master/spec/fixtures/node-v10.20.1.tar.gz",
  "https://github.com/atom-community/apm/raw/master/spec/fixtures/node.lib",
  "https://github.com/atom-community/apm/raw/master/spec/fixtures/node_x64.lib",
  "https://github.com/atom-community/apm/raw/master/spec/fixtures/node-v10.20.1-headers.tar.gz",
  "https://github.com/atom-community/apm/raw/master/spec/fixtures/repo.git",
]

const repos = ["https://github.com/textmate/r.tmbundle"]

async function main() {
  await Promise.all([
    ...links.map((link) => new DownloaderHelper(link, downloadFolder, downloadOptions).start()),
    ...repos.map((repo) => {
      const repoParts = repo.split("/")
      return gitly(repo, join(downloadFolder, repoParts[repoParts.length - 1]), { throw: true })
    }),
  ])
}
main()
