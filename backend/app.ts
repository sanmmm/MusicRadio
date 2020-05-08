import path from 'path'
import registerPath from './registerPath'

const staticPathConfig = process.env.STATIC_PATH || './static'
global.injectedConfigs = {
    isProductionMode: process.env.NODE_ENV === 'production',
    staticPath: path.isAbsolute(staticPathConfig) ? staticPathConfig : path.resolve(process.cwd(), staticPathConfig),
    appendConfigFileDir: process.env.CONFIG_DIR || null,
}

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
import settings from 'root/getSettings'
import globalConfigs from 'global/common/config'
import { SessionTypes } from 'root/type'
import {cookieMiddleware, dispatchClientSettings} from 'root/lib/middlewares'

global.hallRoomId = globalConfigs.hallRoomId
const sessionType = SessionTypes.token

const app = express()
app.use(compression())
app.use(cookieParser(settings.sessionSecret))
app.use(cookieMiddleware)

app.use('/static', express.static(injectedConfigs.staticPath))
app.use(express.urlencoded({
    extended: true
}))
app.use(express.json())
app.use((req, res, next) => {
    console.log(colors.green(`http req: [${req.method}]${req.path}`))
    next()
})
const needSetCors = settings.corsOrigin && settings.corsOrigin.length
if (needSetCors) {
    app.use(cors({
        origin: settings.corsOrigin,
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
app.use(session(sessionType))

const server = new http.Server(app)
const io = socketIo(server, {
    origins: needSetCors ? settings.corsOrigin : '*:*'
})
io.use(session(sessionType))

Handler(io, app, () => {
    server.listen(settings.port, () => {
        console.log(`the server is listening ${settings.port}`)
    })
})