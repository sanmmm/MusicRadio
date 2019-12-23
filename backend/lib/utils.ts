import settings from 'settings'
import redisCli from 'root/lib/redis'
import { UserModel } from 'root/type'

export function isSuperAdmin(user: UserModel) {
    return user.isSuperAdmin
}


export function catchError(target, propertyName, descriptor: PropertyDescriptor) {
    const func = descriptor.value
    descriptor.value = async (...args) => {
        try {
            await func(...args)
        } catch (e) {
            console.error(e)
        }
    }
    return descriptor as TypedPropertyDescriptor<any>
}

export function throttle(
    time: number,
    options: {
        handler?: (...args: any) => any;
        key?: string;
    } = {}
) {
    const { handler, key } = options
    return function (target, propertyName, descriptor: PropertyDescriptor) {
        const func = descriptor.value
        const newFunc = async (...args) => {
            if (time > 0) {
                const redisKey = `musicradio:apithrottle:${key || propertyName}`
                const rejected = await redisCli.exists(redisKey)
                if (rejected && handler) {
                    await handler(...args)
                    return
                }
                await redisCli.safeSet(redisKey, true, time)
            }
            func(...args)
        }
        descriptor.value = newFunc
        return descriptor
    }
}

export function hideIp(ip: string) {
    return ip.replace(/(^[0-9a-f]+)|([0-9a-f]+$)/g, '**')
}

export function safePushArrItem(arr: Array<any>, item: any | any[]) {
    const set = new Set(arr)
    item instanceof Array ? item.forEach(i => set.add(i)) : set.add(item)
    return Array.from(set)
}

export function safeRemoveArrItem(arr: Array<any>, item: any | any[]) {
    const newArr = []
    const delSet = new Set(item instanceof Array ? item : [item])
    arr.forEach(i => {
        if (!delSet.has(i)) {
            newArr.push(i)
        }
    })
    return newArr
}