import axios from 'axios'
import cheerio from 'cheerio'
import fs from 'fs-extra'
import yaml from 'js-yaml'
import chalk from 'chalk'
import path from 'path'

import { AxiosInstance } from 'axios'
import { createWorker, Worker } from 'tesseract.js'

export interface CrawlerInput {
  start: number
  end: number
  timeout: number
  batchSize: number
  batchTimeout: number
  baseUrl: string
}

export function timeout(ms) {
  return new Promise((resolve) =>
    setTimeout(() => resolve(true), ms)
  )
}

export class Crawler {
  static new({
    start,
    end,
    timeout,
    batchSize,
    batchTimeout,
    baseUrl,
  }: CrawlerInput) {
    const http = axios.create({
      baseURL: baseUrl,
    })

    const worker = createWorker({
      logger: (m) =>
        console.log(
          `${chalk.yellow('[tesseract]')} worker=${
            m.workerId
          } status=${m.status} progress=${m.progress}`
        ),
    })

    return new Crawler(
      start,
      end,
      timeout,
      batchSize,
      batchTimeout,
      http,
      worker
    )
  }

  constructor(
    private start: number,
    private end: number,
    private timeout: number,
    private batchSize: number,
    private batchTimeout: number,
    private http: AxiosInstance,
    private worker: Worker
  ) {}

  async crawl() {
    await this.worker.load()
    await this.worker.loadLanguage('eng')
    await this.worker.initialize('eng')

    await this.crawlListOfCompanies()

    await this.worker.terminate()
  }

  async crawlListOfCompanies() {
    let batchOffset = 0

    for (const page of Array.from(
      { length: this.end - this.start },
      (_, k) => this.start + k
    )) {
      console.log(
        `${chalk.yellow(
          '[crawler]'
        )} get list of companies - page=${page}`
      )

      const links = await this.getLinksOfCompanies(page)

      const companies = []

      for (const link of links) {
        batchOffset = (batchOffset + 1) % this.batchSize

        console.log(
          `${chalk.yellow(
            '[crawler]'
          )} get company detail - link=${link}`
        )

        const detail = await this.getCompanyDetail(link)
        const detailContent = yaml.dump([detail])

        console.log(detailContent)

        companies.push(detail)

        if (batchOffset === 0) {
          console.log(
            `${chalk.yellow(
              '[crawler]'
            )} batch timeout - duration=${this.batchTimeout}ms`
          )

          await timeout(this.batchTimeout)
        } else {
          await timeout(this.timeout)
        }
      }

      await fs.outputFile(
        path.resolve('data', `page-${page}.yaml`),
        yaml.dump(companies)
      )
    }
  }

  private getLinksOfCompanies(page: number): Promise<string[]> {
    return this.http
      .get('/', {
        params: {
          page: page.toString(),
        },
      })
      .then((response) => {
        return this.extractLinksOfCompanies(response.data)
      })
  }

  private extractLinksOfCompanies(
    pageContent: string
  ): string[] {
    const $ = cheerio.load(pageContent)

    const searchResults$ = $(
      '.search-results',
      'body .container .col-xs-12.col-sm-9'
    )

    return searchResults$
      .toArray()
      .map((item) => $('a', item).first().attr('href'))
  }

  private getCompanyDetail(link): Promise<any> {
    return this.http.get(link).then((response) => {
      return this.extractCompanyDetail(response.data)
    })
  }

  private async extractCompanyDetail(
    pageContent: string
  ): Promise<any> {
    const $ = cheerio.load(pageContent)

    const $jumbotron = $('.jumbotron')

    const data = {}

    for (const childNode of $jumbotron[0].childNodes) {
      switch (childNode.type) {
        case 'text': {
          const field = ((childNode as any).data ?? '').split(
            ':'
          )

          const fieldName = field[0].trim()
          const fieldValue = field.slice(1).join(':').trim()

          if (fieldName === '') {
            break
          }

          if (fieldName.includes('Ngày hoạt động')) {
            data[fieldName] = fieldValue

            let nextChildNode = childNode
            for (const i of Array.from(
              { length: 3 },
              (_, k) => k
            )) {
              nextChildNode = nextChildNode.next
              let $nextChildNode = $(nextChildNode)

              data[fieldName] =
                data[fieldName] + ($nextChildNode.text() ?? '')
            }
          } else if (fieldName.includes(')')) {
            break
          } else if (fieldName.includes('Mã số thuế')) {
            const base64Img = $('img', $jumbotron)
              .attr('src')
              .split('base64,')[1]

            const imageBuffer = Buffer.from(base64Img, 'base64')

            const {
              data: { text },
            } = await this.worker.recognize(imageBuffer)

            data[fieldName] = text.trim()
          } else {
            data[fieldName] = fieldValue
          }

          break
        }

        case 'tag': {
          const $element = $(childNode)

          if ($element.is('h4')) {
            data['Tên công ty'] = $element.text()
          }

          break
        }
      }
    }

    return data
  }
}
