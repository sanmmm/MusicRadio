import redisCli from 'root/lib/redis';
import {useBlock} from '../lib/utils'
import {wait} from './_testTool'

beforeAll(() => {
    return redisCli.select(1)
})

afterAll(() => {
    return redisCli.flushdb()
})

describe('useblock', () => {
    it('useblock',() => {
        return expect(useBlock('testError', {
            wait: true,
            success: async () => {
                throw new Error('test Error')
            },
            failed: () => {
            }
        })).rejects.toThrowError()
    })

    it('useblock success', async () => {
        const fn = jest.fn()
        await expect(useBlock('exec2', {
            wait: true,
            success: fn,
            failed: () => {
            }
        }))
        expect(fn).toBeCalled()
    })

    it('useblock failed', async () => {
        const handleFailed = jest.fn()
        expect(useBlock('exec2', {
            wait: false,
            success: () => {},
            failed: () => {
            }
        }))
        await expect(useBlock('exec2', {
            wait: false,
            success: () => {},
            failed: handleFailed
        }))
        expect(handleFailed).toBeCalled()
    })

    
    it('useblock wait', async () => {
        const f1 = jest.fn()
        const f2 = jest.fn()
        useBlock('exec3', {
            wait: false,
            success: () => wait(100),
            failed: () => {
            }
        })
        await useBlock('exec3', {
            wait: true,
            success: f1,
            failed: f2
        })
        expect(f1).toBeCalled()
        expect(f2).not.toBeCalled()
    })

})