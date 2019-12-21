import settings from 'settings'
import redisCli from 'root/lib/redis'
import { UserModel } from 'root/type'

export function isSuperAdmin(user: UserModel) {
    return user.isSuperAdmin
}


export function catchError(target, propertyName, descriptor: PropertyDescriptor): any {
    const func = descriptor.value
    return (async (...args) => {
        try {
            func(...args)
        } catch (e) {
            console.error
        }
    })
}

export function throttle(options: {
    time: number;
    handler?: (...args: any) => any;
    key?: string;
}) {
    const {time = 1000, handler, key} = options || {}
    return function (target, propertyName, descriptor: PropertyDescriptor) {
        const func = descriptor.value
        return async (...args) => {
            if (time > 0) {
                const redisKey = `musicradio:apithrottle:${key || propertyName}`
                const flag = await redisCli.exists(redisKey)
                if (flag) {
                    await handler(...args)
                    return
                }
                await redisCli.safeSet(redisKey, true, time)
            }
            func(...args)
        }
    }
}

export function hideIp(ip: string) {
    return ip.replace(/(^[0-9a-f]+)|([0-9a-f]+$)/g, '**')
}

export function safePushArrItem(arr: Array<any>, item: any) {
    return Array.from(new Set(arr).add(item))
}

export function safeRemoveArrItem(arr: Array<any>, item: any) {
    const findIndex = arr.indexOf(item)
    if (findIndex > -1) {
        arr.splice(findIndex, 1)
    }
    return arr
}