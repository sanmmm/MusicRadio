import registerPath from './registerPath'
global.isBuildMode = process.env.IS_BUILD_MODE === '1'
global.isProductionMode = process.env.NODE_ENV === 'production'
if (isBuildMode) {
    registerPath()
}

import express from 'express'
import compression from 'compression'
import cookieParser from 'cookie-parser'
import http from 'http'
import uuidV4 from 'uuid/v4'
import socketIo from 'socket.io';
import reactViews from 'express-react-views'
import path from 'path'
import cors from 'cors'

import session from 'root/lib/session'
import Handler from 'root/lib/handler'
import settings from 'root/settings'
import globalConfigs from 'global/common/config'
import { SessionTypes } from 'root/type'

global.hallRoomId = globalConfigs.hallRoomId
const sessionType = SessionTypes.token

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

const staticPath = isBuildMode ? path.resolve(__dirname, '../../static') : 'static'
app.use('/static', express.static(staticPath))
app.use(express.urlencoded({
    extended: true
}))
app.use(express.json())
const needSetCors = settings.corsOrigin && settings.corsOrigin.length
if (needSetCors) {
    app.use(cors({
        origin: settings.corsOrigin,
    }))
}
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'tsx');
app.engine('tsx', reactViews.createEngine({
    transformViews: false,
}));
app.use(session(sessionType))

const server = new http.Server(app)
const io = socketIo(server, {
    origins: needSetCors ? settings.corsOrigin : '*:*'
})
io.use(session(sessionType))

Handler(io, app)
server.listen(settings.port, () => {
    console.log(`the server is listening ${settings.port}`)
})