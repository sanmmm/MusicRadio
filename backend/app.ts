import express from 'express'
import compression from 'compression'
import cookieParser from 'cookie-parser'
import http from 'http'
import uuidV4 from 'uuid/v4'

import session from 'root/lib/session'
import socketHandler from 'root/lib/handler'
import settings from 'root/settings'
import globalConfigs from 'global/common/config'
import { SessionTypes } from 'root/type'

global.hallRoomId = globalConfigs.hallRoomId

const app = express()
app.use(compression())
app.use(cookieParser(settings.sessionSecret))
app.use((req, res, next) => {
    let cookie = req.cookies[settings.sessionKey]
    if (!cookie) {
        const uuid = uuidV4()
        res.cookie(settings.sessionKey, uuid, { signed: true, maxAge: settings.sessionExpire, })
    }
    next()
})
app.use((req, _, next) => {
    session(SessionTypes.ip)(req, next)
})
app.use('/static', express.static('static'))
app.use('/test', (_, res) => {
    res.send('test')
})
app.use((err, req, res, next) => {
    console.error(err)
    next()
})

const server = new http.Server(app)
socketHandler(server)
server.listen(settings.port, () => {
    console.log(`the server is listening ${settings.port}`)
})