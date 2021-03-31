const axios = require('axios').default
const cheerio = require('cheerio')

const { createWorker } = require('tesseract.js')

const worker = createWorker()

async function main() {
  await worker.load()
  await worker.loadLanguage('eng')
  await worker.initialize('eng')

  const pageContent = (
    await axios.get(
      'https://www.thongtincongty.com/company/3fa7c193-cong-ty-tnhh-tm-dv-hms-full-house/'
    )
  ).data

  const $ = cheerio.load(pageContent)

  const $jumbotron = $('.jumbotron')

  const childNodes = $jumbotron[0].childNodes

  const data = {}

  for (const childNode of childNodes) {
    switch (childNode.type) {
      case 'text': {
        const field = (childNode.data ?? '').split(':')

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
          } = await worker.recognize(imageBuffer)

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

  await worker.terminate()
}

main()
  .then()
  .catch((err) => console.error(err))
