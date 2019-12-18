import IoRedis from 'ioredis'

import settings from 'root/settings'

export class Redis extends IoRedis {
    async safeSet (key: string, value: any, expire = 3600) {
        return this.set(key, JSON.stringify(value), 'EX', expire)
    }
    async safeGet (key) {
        const dataStr = await this.get(key)
        return dataStr ? JSON.parse(dataStr) : null
    }
}

export default new Redis(settings.redisPort, settings.redisHost)