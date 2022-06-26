const { DownloaderHelper } = require("node-downloader-helper")
const gitly = require("gitly").default
const { join, dirname } = require("path")
const { readFileSync } = require("fs")

const downloadFolder = join(dirname(__dirname), "spec", "fixtures")

const downloadOptions = {
  override: { skip: true },
}

const atomElectronVersion = readFileSync(`${dirname(__dirname)}/.npmrc`, "utf8").match(/target=(.*)\n/)[1]

const links = [
  `https://nodejs.org/dist/${atomElectronVersion}/node-${atomElectronVersion}.tar.gz`,
  `https://nodejs.org/dist/${atomElectronVersion}/win-x86/node.lib`,
  `https://nodejs.org/dist/${atomElectronVersion}/node-${atomElectronVersion}-headers.tar.gz`,
  "https://github.com/atom-community/apm/raw/master/spec/fixtures/repo.git",
]

const linkMaps = [[`https://nodejs.org/dist/${atomElectronVersion}/win-x64/node.lib`, `node_x64.lib`]]

const repos = ["https://github.com/textmate/r.tmbundle"]

async function main() {
  console.log(`Downloading fixtures for node ${atomElectronVersion}`)
  await Promise.all([
    ...links.map((link) => {
      console.log(`Downloading ${link}`)
      return new DownloaderHelper(link, downloadFolder, downloadOptions).start()
    }),
    ...linkMaps.map((linkMap) => {
      const link = linkMap[0]
      console.log(`Downloading ${link}`)
      downloadOptions.fileName = linkMap[1]
      return new DownloaderHelper(link, downloadFolder, downloadOptions).start()
    }),
    ...repos.map((repo) => {
      console.log(`Downloading ${repo}`)
      const repoParts = repo.split("/")
      return gitly(repo, join(downloadFolder, repoParts[repoParts.length - 1]), { throw: true })
    }),
  ])
}
main()
