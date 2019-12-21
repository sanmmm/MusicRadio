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
t
    async tryGet<T> (key: string, getData: () => Promise<T>, expire?: number) {
        let cache = await this.safeGet(key)
        if (!cache) {
            cache = await getData() 
            await this.safeSet(`musicradio:cache:${key}`, cache, expire)
        }
        return cache as T
    }   
} 

export default new Redis(settings.redisPort, settings.redisHost)