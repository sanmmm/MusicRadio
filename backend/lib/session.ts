
import express from 'express'
import socketIo from 'socket.io'
import cookieParser from 'cookie-parser'
import cookie from 'cookie'

import settings from 'root/settings'
import {User} from 'root/lib/models'
import {SessionTypes, UserModel} from 'root/type'
const tokenHeaderName = 'my-app-certification-token'

const getIp = (str) => {
    if (str.startsWith('::ffff:')) {
        str = str.replace('::ffff:', '')
    }
    return str
}

export default  function session (type: SessionTypes = SessionTypes.cookie) {
    return async (req: express.Request | socketIo.Socket['request'], next: Function) => {
        console.log('inner session middleware')
        let sessionId = ''
        const ipAddress = getIp(req.socket.remoteAddress)
        if (type === SessionTypes.ip) {
            sessionId = ipAddress
        }
        if (type === SessionTypes.cookie) {
            const cookieStr = req.headers.cookie
            const cookies = cookie.parse(cookieStr || '')
            const signedCookies = cookieParser.signedCookies(cookies, settings.sessionSecret)
            sessionId = signedCookies[settings.sessionKey]
        }
        if (type === SessionTypes.token) {
            sessionId = req.headers[tokenHeaderName] as string
        }
        console.log(sessionId)
        let userDoc: UserModel = null
        if (sessionId) {
            let userDoc = await User.findOne(sessionId)
            if (!userDoc) {
                userDoc = new User({
                    id: sessionId,
                    ip: ipAddress,
                })
            }
            userDoc.ip = ipAddress
            await userDoc.save()
        }
        req.session = {
            id: sessionId,
            ip: ipAddress,
            user: userDoc,
            isAuthenticated: !!userDoc
        }
        next()
    }
}
