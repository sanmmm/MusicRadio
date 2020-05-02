import express from 'express'
import socketIo, {Socket} from 'socket.io'
import cookieParser from 'cookie-parser'
import cookie from 'cookie'
import {URLSearchParams} from 'url'
import http from 'http'
 
import settings from 'root/settings'
import {User} from 'root/lib/models'
import redisCli from 'root/lib/redis'
import {SessionTypes, UserModel, Session as SessionDef, SessionStoreData, UserStatus} from 'root/type'
import globalConfigs from 'global/common/config'
import {getRandomIp} from 'root/lib/utils'
const {authTokenFeildName: authTokenKey} = globalConfigs

const getIp = (str) => {
    if (global.isProductionMode && settings.openRandomIpMode) {
        return getRandomIp()
    }
    if (str.startsWith('::ffff:')) {
        str = str.replace('::ffff:', '')
    }
    return str
}

class Session implements SessionDef {
    storeData: SessionStoreData = {
        userId: null,
        defaultUserId: null,
    };
    id: string;
    ip: string;
    isAuthenticated: boolean = false;
    user: UserModel;
    type: SessionTypes;
    constructor (obj: Pick<Session, 'ip' | 'id' | 'type'> | Session) {
        Object.assign(this, obj)
    }
    private preCheck () {
        if (!this.id) {
            throw new Error('invalid session id')
        }
    }
    private getSessionStoreRedisKey () {
        this.preCheck()
        return `musicradio:sessionstore:${this.id}`
    }
    private async saveSessionStoreData () {
        const redisKey = this.getSessionStoreRedisKey()
        await redisCli.safeSet(redisKey, this.storeData, 3600 * 24 * 356)
    }
    private async getSessionStoreData () {
        const redisKey = this.getSessionStoreRedisKey()
        const data = await redisCli.safeGet(redisKey)
        if (data) {
            this.storeData = data
        }
        return this.storeData
    }
    async login (user: UserModel) {
        this.preCheck()
        this.user = user
        this.isAuthenticated = true
        this.storeData.userId = this.user.id
        await this.saveSessionStoreData()
    }
    async logOut () {
        this.preCheck()
        this.user = null
        this.isAuthenticated = false
        this.storeData.userId = null
        await this.saveSessionStoreData()
    }
    async load () {
        this.preCheck()
        
        await this.getSessionStoreData()
        const {userId} = this.storeData
        let user = null, isInitial = false
        if (userId) {
            user = await User.findOne(userId)
        }
        if (!user) {
            isInitial = true
            user = new User({
                id: userId,
                ip: this.ip,
                name: globalConfigs.initNickNamePerfix + Math.random().toString(32).slice(2),
            })
        }
        user.ip = this.ip
        if (this.type === SessionTypes.token && settings.superAdminToken.includes(this.id) && user.status < UserStatus.superOfNormal) {
            console.log('dev mode: is super admin')
            user.status = UserStatus.superAdmin
        }
        await user.save()
        this.isAuthenticated = true
        this.user = user
        if (isInitial) {
            this.storeData.userId = this.user.id
            this.storeData.defaultUserId = this.user.id
            await this.saveSessionStoreData()
        }
    }
}

export default function session (type: SessionTypes = SessionTypes.cookie) {
    return async (...args) => {
        const isSocketMode = args.length === 2
        const req: http.IncomingMessage = isSocketMode ? (args[0] as Socket).request : args[0]
        const next: Function = isSocketMode ? args[1] : args[2]
        try {
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
                const searchStr = req.url.split('?').pop() || ''
                const searchParams = new URLSearchParams(searchStr)
                sessionId = searchParams.get(authTokenKey) as string
            }
            console.log(`inner session middleware: ${sessionId}`)
            const session = new Session({
                id: sessionId,
                ip: ipAddress,
                type,
                isAuthenticated: false,
            })
            await session.load();

            if (isSocketMode) {
                const socket: Socket = args[0]
                socket.session = session
            } else {
                (req as express.Request).session = session
            }
            next()
        } catch (e) {
            console.error(e)
            next(e)
        }
    }
}