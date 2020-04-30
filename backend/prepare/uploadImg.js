const got = require('got')
const cheerio = require('cheerio')
const fs = require('fs')
const formData = require('form-data')
const tunnel = require('tunnel')

const pageCount = 21
const baseUrl = 'https://fabiaoqing.com/biaoqing/lists/page/'

const successFileName = 'success.json'
const originImgFileName = 'originImgs.json'

const uploadImgs = async (imgs = []) => {
    console.log('start upload imgs')
    let preData
    try {
        preData = fs.readFileSync(successFileName)
    } catch (e) {
    }
    const successImgs = preData ? JSON.parse(preData) : []
    const successUrlSet = successImgs.reduce((set, item) => {
        set.add(item.originUrl)
        return set
    }, new Set())
    for (let obj of imgs) {
        try {
            if (successUrlSet.has(obj.originUrl)) {
                continue
            }
            console.log('upload img:' + obj.originUrl)
            const fileName = obj.originUrl.trim().split('/').pop()
            const res = await got(obj.originUrl, {
                encoding: null
            })
            console.log('load img success')
            const form = formData()
            form.append('smfile', res.body, fileName)
            form.append('file_id', fileName)
            const uploadRes = await got.post('https://sm.ms/api/upload', {
                body: form,
                // agent: tunnel.httpOverHttp({
                //     proxy: {
                //         host: 'localhost',
                //         port: 2020,
                //     }
                // }),
                headers: {
                    // 'Authorization': ''
                }
            })
            const { success, message, data } = JSON.parse(uploadRes.body)
            if (!success) {
                throw new Error(message)
            }
            // upload
            successImgs.push({
                ...obj,
                url: data.url,
                deleteUrl: data.delete
            })
            fs.writeFileSync(successFileName, JSON.stringify(successImgs))
        } catch (e) {
            console.log('upload error \n')
            console.error(e)
        }
    }
    // fs.writeFileSync(successFileName, successImgs)
    console.log('upload end')
}

async function main() {
    let imgArr = []
    let preData
    try {
        preData = fs.readFileSync(originImgFileName)
    } catch (e) {
    }
    imgArr = preData ? JSON.parse(preData) : []
    console.log('start crawl imgs`')
    if (!imgArr.length) {
        for (let i = 11; i <= pageCount; i++) {
            const aimUrl = baseUrl + pageCount
            const res = await got(aimUrl)
            const $ = cheerio.load(res.body)
            const imgs = $('img.image').map((i, ele) => {
                return {
                    title: ele.attribs['title'],
                    originUrl: ele.attribs['data-original'],
                }
            }).get()
            imgArr = imgArr.concat(imgs)
        }
        fs.writeFileSync(originImgFileName, JSON.stringify(imgArr))
    }
    console.log('crawl img end')
    uploadImgs(imgArr)
}

main()

async function test() {
    const res = await got('http://wx2.sinaimg.cn/large/0068Lfdely1g667lmi7njj30af0aegmz.jpg', {
        encoding: null
    })
    const form = formData()
    form.append('smfile', res.body, '005Me9Ycgy1g7f7b97zwwj305i05i3yv.jpg')
    form.append('file_id', '2342323')
    const uploadRes = await got.post('https://sm.ms/api/upload', {
        body: form,
    })
    const { success, message, data } = JSON.parse(uploadRes.body)
    if (!success) {
        console.log(message)
        throw new Error(message)
    }
}

// test()