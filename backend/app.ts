import path from 'path'
import registerPath from './registerPath'
import {injectedConfigs} from './getSettings'

if (injectedConfigs.isProductionMode) {
    registerPath()
}

import colors from 'colors/safe'
import express from 'express'
import compression from 'compression'
import cookieParser from 'cookie-parser'
import http from 'http'
import socketIo from 'socket.io';
import reactViews from 'express-react-views'
import cors from 'cors'

import session from 'root/lib/session'
import Handler from 'root/lib/handler'
import settings, {clientSettings} from 'root/getSettings'
import globalConfigs from 'global/common/config'
import { SessionTypes } from 'root/type'
import {cookieMiddleware, dispatchClientSettings, umiFileHandler} from 'root/lib/middlewares'
import {fillVaraibleToFile} from 'root/lib/tools'

global.hallRoomId = globalConfigs.hallRoomId
const sessionType = SessionTypes[injectedConfigs.sessionType] as SessionTypes

fillVaraibleToFile({
    filePath: path.join(injectedConfigs.staticPath, 'index.html'),
    exportTo: path.join(injectedConfigs.staticPath, 'index_server.html'),
    vars: {
        HTTP_SERVER: settings.httpServer.replace(/\/$/, ''),
        WEBSITE_TITLE: clientSettings.websiteName,
    }
})

const app = express()
app.use(compression())
app.use(cookieParser(settings.sessionSecret))
app.use(cookieMiddleware)
app.use((req, res, next) => {
    console.log(colors.green(`http req: [${req.method}]${req.originalUrl}`))
    next()
})

app.use('/static', express.static(injectedConfigs.staticPath))
app.use(express.urlencoded({
    extended: true
}))
app.use(express.json())

const needSetCors = !!(settings.corsOrigin && settings.corsOrigin.length)
if (needSetCors) {
    app.use(cors({
        origin: settings.corsOrigin,
        credentials: true,
    }))
}
app.set('views', path.join(__dirname, 'views'));
if (!injectedConfigs.isProductionMode) {
    app.set('view engine', 'tsx')
    app.engine('tsx', reactViews.createEngine({
        transformViews: false,
    }));
} else {
    app.set('view engine', 'js')
    app.engine('js', reactViews.createEngine({
        transformViews: false,
    }));
}
// 放在sesion中间件前面
app.get('/client/settings', dispatchClientSettings)
app.get(/^\/umi\..+\.(js|css)/, umiFileHandler)
app.use(session(sessionType))

const server = new http.Server(app)
const io = socketIo(server, {
    origins: needSetCors ? (settings.corsOrigin).map(url => {
        if (url.startsWith('https') && !url.endsWith(':443')) {
            const pureUrlStr = new URL(url).toString()
            return pureUrlStr.replace(/\/$/, ':443')
        }
        return url
    }) : '*:*'
})
io.use(session(sessionType))

Handler(io, app, () => {
    server.listen(settings.port, () => {
        console.log(`the server is listening ${settings.port}`)
    })
})