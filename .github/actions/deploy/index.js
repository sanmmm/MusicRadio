const got = require('got')
const core = require('@actions/core')
const shell = require('@actions/exec')

function wait (time = 1000) {
    return new Promise((resolve, reject) => {
        setTimeout(resolve, time)
    })
}

async function getInputArgs() {
    const serverUrl = core.getInput('server').replace(/\/$/, '')
    const accessToken = core.getInput('access_token')
    const imageName = core.getInput('image_name')
    let shellOut = '', shellErr = ''
    await shell.exec(`git rev-parse --short ${process.env.GITHUB_SHA}`, [],
        {
            listeners: {
                stdout: (data) => {
                    shellOut += data.toString()
                },
                stderr: (data) => {
                    shellErr += data.toString()
                }
            }
        }
    )
    return {
        serverUrl,
        accessToken,
        imageName,
        tag: shellOut.replace(/\n/g, '')
    }
}


async function main() {
    try {
        const args = await getInputArgs()
        // console.log(args)
        const reqData = {
            token: args.accessToken,
            imageName: args.imageName,
            imageTag: args.tag
        }
        const res = await got(args.serverUrl + '/updateImage', {
            method: 'POST',
            json: reqData,
            responseType: 'json',
            timeout: 10000
        })
        if (res.body.code !== 0) {
            throw new Error(`req update image failed: ${res.body.msg || '未知原因'}`)
        }
        let i = 0, isSuccess = false
        do {
            i++
            console.log(`check image tag/ time: ${i}`)
            const reqData = {
                token: args.accessToken,
                imageName: args.imageName,
            }
            const checkRes = await got(args.serverUrl + '/getImageTag', {
                method: 'POST',
                json: reqData,
                responseType: 'json',
                timeout: 10000
            })
            const {code, tag} = checkRes.body
            if (code === 0 && tag === args.tag) {
                isSuccess = true
                break
            }
            if (i >= 30) {
                throw new Error(`请求更新失败，请求次数:${i}`)
            }
            await wait(1000 * 10)
        } while (true)
        
        if (isSuccess) {
            console.log('deploy success!!')
        } else {
            core.setFailed('部署失败')
        }
    } catch (e) {
        core.setFailed(e.message)
    }
}

main()