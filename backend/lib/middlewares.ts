import {Request, Response, NextFunction} from 'express'
import uuidV4 from 'uuid/v4'

import settings, {clientSettings} from 'root/getSettings'


export function cookieMiddleware (req: Request, res: Response, next: NextFunction) {
    let cookie = req.signedCookies[settings.sessionKey]
    if (!cookie) {
        const uuid = uuidV4()
        req.signedCookies = {
            ...req.signedCookies,
            [settings.sessionKey]: uuid,
        }
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

export function umiFileHandler (req: Request, res: Response, next) {
    res.send('not found')
    next()
}