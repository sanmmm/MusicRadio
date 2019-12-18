import got from 'got'
import path from 'path'

import settings from 'root/settings'

export default async function getMusicInfo (apiRoute: string, params: {[key: string]: any}) {
    return got(path.join(settings.neteaseApiServer, apiRoute), {
        query: params
    })
}