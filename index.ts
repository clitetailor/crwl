import meow from 'meow'
import { Crawler } from './crawler'

async function main() {
  const cli = meow(
    `
Usage
  $ yarn ts-node index.ts <start> <end>
`,
    {}
  )

  await Crawler.new({
    start: Number(cli.input[0] || 1),
    end: Number(cli.input[1] || 500),
    baseUrl: 'https://www.thongtincongty.com/thanh-pho-ha-noi/',
  }).crawl()
}

main()
  .then()
  .catch((err) => console.error(err))
