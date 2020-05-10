import redisCli from 'root/lib/redis'
import { wait } from './_testTool'

beforeAll(() => {
    return redisCli.select(1)
})

afterAll(() => {
    return redisCli.flushdb()
})

beforeEach(() => {
    return redisCli.flushdb()
})

const genRedisKey = () => '' + Date.now()
it('safeset/safeget', async () => {
    const data = {
        a: '22323'
    }
    const key = genRedisKey()
    await expect(redisCli.safeSet(key, data)).resolves.not.toThrowError()
    await expect(redisCli.safeGet(key)).resolves.toEqual(data)
})

it('redis safeset expire', async () => {
    const data = {
        a: '22323'
    }
    const key = genRedisKey()
    const expire = 3
    await expect(redisCli.safeSet(key, data, expire)).resolves.not.toThrowError()
    await expect(redisCli.safeGet(key)).resolves.toEqual(data)
    await wait(expire * 1000)
    await expect(redisCli.safeGet(key)).resolves.toBe(null)
})