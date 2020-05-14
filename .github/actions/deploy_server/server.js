const http = require('http')
const express = require('express')
const shell = require('shelljs')
const dotenv = require('dotenv')
dotenv.config()

const injectedConfigs = {
    accessToken: process.env.D_ACCESS_TOKEN || 'token',
    port: process.env.D_PORT || 3003,
    watchImageNameList: (process.env.D_IMAGES || '').split(',').filter(n => !!n),
    workdir: process.env.D_WORD_DIR || __dirname,
    routerBasePath: process.env.D_ROUTER_BASE  || '/',
}

function parseItemInfo (itemInfoStr) {
    if (!itemInfoStr) {
        return null
    }
    const itemInfoArr = itemInfoStr.trim().split(/\s+/)
    const [name, tag, id] = itemInfoArr
    return {
        name,
        tag,
        id,
    }
}

function findLocalImageInfo (imageName) {
    const output = shell.exec('docker image ls', {
        silent: true
    })
    const items = output.stdout.split('\n').slice(1)
    const findOneStr = items.find(item => {
        const info = parseItemInfo(item)
        if (info.name === imageName) {
            return true
        }
    })
    return parseItemInfo(findOneStr)
}

function filterImageName (imageName) {
    return injectedConfigs.watchImageNameList.includes(imageName)
}

function preCheckBeforeStart () {
    if (!injectedConfigs.accessToken) {
        throw new Error('没有配置访问token')
    }
}


const app = express()

app.use(express.json())
app.use(express.urlencoded())
app.use(function (req, res, next) {
    console.log(`req:[${req.method}] ${req.originalUrl}`)
    try {
        const {token} = req.body
        if (token !== injectedConfigs.accessToken) {
            console.log('unauthorized')
            return res.json({
                code: -1,
                msg: 'unauthorized'
            })
        } 
        next()
    } catch (e) {
        next(e)
    }
})
const router = express.Router()
router.post('/updateImage', (req, res, next) => {
    try {
        const {imageName, imageTag} = req.body
        if (!imageTag || !imageName) {
            throw new Error('invalid params')
        }
        if (!filterImageName(imageName)) {
            throw new Error('不支持更新该镜像')
        }
        console.log(`inner update image: ${imageName}:${imageTag}`)
        const localImageInfo = findLocalImageInfo(imageName)
        if (localImageInfo && localImageInfo.tag !== imageTag) {
            console.log(`fetch image: ${imageName}:${imageTag}`)
            setImmediate(() => {
                try {
                    shell.exec(`docker pull ${imageName}:${imageTag}`, function (code, stdout, stderr) {
                        if (code === 0) {
                            // console.log(stdout)
                            const pureImageName = imageName.split('/').filter(i => !!i).pop()
                            const command = `cd ${injectedConfigs.workdir} && export CONFIG_DIR=./config && export ${pureImageName.toUpperCase()}_TAG=${imageTag} && docker-compose down && docker-compose up -d`
                            console.log(command)
                            shell.exec(command, function (code, stdout, stderr) {
                                // console.log(stdout)
                                // console.error(stderr)
                            })
                        } else {
                            // console.error(stderr)
                        }
                    })
                } catch (e) {
                    console.error(e)
                }
            })
        }
        res.json({
            code: 0
        })
        next()
    } catch (e) {
        next(e)
    }
})

router.post('/getImageTag', function (req, res, next) {
    try {
        const {imageName} = req.body
        const localImageInfo = findLocalImageInfo(imageName)

        res.json({
            code: 0,
            tag: localImageInfo && localImageInfo.tag
        })
    } catch (e) {
        next(e)
    }
})

app.use(injectedConfigs.routerBasePath, router)
app.use(function (error, req, res, next) {
    console.error(error)
    res.json({
        code: -1,
        msg: error.message
    })
})

preCheckBeforeStart()
const server = http.createServer(app)
server.listen(injectedConfigs.port)
