
import express from 'express'
import socketIo from 'socket.io'
import cookieParser from 'cookie-parser'
import cookie from 'cookie'
import {URL} from 'url'

import settings from 'root/settings'
import {User} from 'root/lib/models'
import redisCli from 'root/lib/redis'
import {SessionTypes, UserModel, Session as SessionDef} from 'root/type'
import globalConfigs from 'global/common/config'
const {tokenHeaderName: authTokenKey} = globalConfigs

const getIp = (str) => {
    if (str.startsWith('::ffff:')) {
        str = str.replace('::ffff:', '')
    }
    return str
}

class Session implements SessionDef {
    static sessionToUserIdKey (sessioId: string) {
        return `musicradio:sessiontosuer:${sessioId}`
    }
    id: string;
    ip: string;
    isAuthenticated: boolean = false;
    user: UserModel;
    constructor (obj: Partial<Session>) {
        Object.assign(this, obj)
    }
    async login (user: UserModel) {
        if (!this.id) {
            throw new Error('invalid session id')
        }
        const redisKey = Session.sessionToUserIdKey(this.id)
        await redisCli.safeSet(redisKey, user.id, 3600 * 24 * 7)
    }
    async logOut () {
        if (!this.id) {
            throw new Error('invalid session id')
        }
        const redisKey = Session.sessionToUserIdKey(this.id)
        await redisCli.del(redisKey)
    }
    async getUser () {
        if (!this.id) {
            return
        }
        const redisKey = Session.sessionToUserIdKey(this.id)
        const userId = (await redisCli.safeGet(redisKey)) || this.id
        let user = await User.findOne(userId)
        if (!user) {
            user = new User({
                id: userId,
                ip: this.ip,
            })
        }
        user.ip = this.ip
        await user.save()
        this.user = user
        this.isAuthenticated = !!this.user
        return this.user
    }
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
            const urlObj = new URL(`http://t.com/${req.url}`)
            sessionId = urlObj.searchParams.get(authTokenKey) as string
        }
        console.log(sessionId)
        const session = new Session({
            id: sessionId,
            ip: ipAddress,
            isAuthenticated: false,
        })
        await session.getUser()
        req.session = session
        next()
    }
}
