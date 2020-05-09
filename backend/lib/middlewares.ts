import {Request, Response, NextFunction} from 'express'
import settings, {clientSettings} from 'root/getSettings'
import uuidV4 from 'uuid/v4'


export function cookieMiddleware (req: Request, res: Response, next: NextFunction) {
    let cookie = req.signedCookies[settings.sessionKey]
    if (!cookie) {
        const uuid = uuidV4()
        res.cookie(settings.sessionKey, uuid, { signed: true, maxAge: settings.sessionExpire * 1000 , })
    }
    next()
}


export function dispatchClientSettings (req: Request, res: Response, next: NextFunction) {
    res.jsonp({
        code: 0,
        data: {
            ...clientSettings,
        }
    })
    next()
}