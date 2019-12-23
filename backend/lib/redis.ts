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
    /**
     * 
     * @param key  缓存key
     * @param getData 数据获取函数
     * @param expire 缓存有限期
     * @param deps  依赖该缓存的上级缓存的keys, 该缓存更新之后会清除上游依赖缓存
     */
    async tryGet<T> (key: string, getData: (cacheKey: string) => Promise<T> | T, expire: number, deps: string[] = []) {
        const redisKey = `musicradio:cache:${key}`
        let {cache, deps: oldDeps = []} = (await this.safeGet(redisKey) as {cache: T, deps: string[]})
        deps = Array.from(new Set(oldDeps.concat(deps)))
        let needSave = deps.length !== oldDeps.length;

        if (!cache) {
            needSave = true
            cache = await getData(redisKey)
            await this.del(...deps)
        }
        if (needSave) {
            await this.safeSet(redisKey, {
                cache,
                deps
            }, expire)
        }
        return cache as T
    }   

    async getCache<T = any> (key) {
        const redisKey = `musicradio:cache:${key}`
        const {cache, deps: oldDeps = []} = (await this.safeGet(redisKey) as {cache: T, deps: string[]})
        return cache
    }
} 

export default new Redis(settings.redisPort, settings.redisHost)