import meow from 'meow'
import chalk from 'chalk'

import { Crawler } from './crawler'

async function main() {
  const cli = meow(
    `
Usage
  $ yarn ts-node index.ts <start-page> <end-page>

Options
  --timeout         Duration between pages
  --batch-size      
  --batch-timeout
`,
    {
      flags: {
        timeout: {
          type: 'number',

          default: 100,
        },
        batchSize: {
          type: 'number',
          default: 15,
        },
        batchTimeout: {
          type: 'number',
          default: 10_000,
        },
      },
    }
  )

  console.log(
    chalk.yellow(`[crawler]`),
    `flags - ${JSON.stringify(cli.flags)}`
  )

  await Crawler.new({
    start: Number(cli.input[0] || 1),
    end: Number(cli.input[1] || 500),
    timeout: cli.flags.timeout,
    batchSize: cli.flags.batchSize,
    batchTimeout: cli.flags.batchTimeout,
    baseUrl: 'https://www.thongtincongty.com/thanh-pho-ha-noi/',
  }).crawl()
}

main()
  .then()
  .catch((err) => console.error(err))
