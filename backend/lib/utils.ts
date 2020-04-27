import settings from 'settings'
import redisCli from 'root/lib/redis'
import { UserModel } from 'root/type'

export function isSuperAdmin(user: UserModel) {
    return user.isSuperAdmin
}

export class PayloadError<T = any> extends Error {
    payload: T
    constructor(message: string, data?: any) {
        super(message)
        this.payload = data
    }
}

/**
 * 捕获到api抛出的该类型错误将会讲错误信息返回到前端，
 * isGlobal参数用来标识返回信息是否 在前端页面全局弹出显示
 */
export class ResponseError extends Error {
    isGlobal: boolean;
    constructor(message: string, isGlobal = true) {
        super(message)
        Object.setPrototypeOf(this, new.target.prototype)
        this.isGlobal = isGlobal
    }
}

export function catchError(handler?: (error: Error, ...args: any) => any) {
    return function (target, propertyName, descriptor: PropertyDescriptor) {
        const func = descriptor.value
        descriptor.value = async (...args) => {
            try {
                await func(...args)
            } catch (e) {
                console.error(e)
                handler && handler(e, ...args)
            }
        }
        return descriptor as TypedPropertyDescriptor<any>
    }
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
            await func(...args)
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

export function shuffleArr(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const swapIndex = Math.floor(Math.random() * i)
        const backUp = arr[i]
        arr[i] = arr[swapIndex]
        arr[swapIndex] = backUp
    }
    return arr
}

export function getRandomIp() {
    const ips = [
        "60.13.42.157",
        "180.104.63.242",
        "219.159.38.200",
        "175.42.68.223",
        "1.198.73.202",
        "125.108.76.226",
        "106.75.177.227",
        "124.93.201.59",
        "121.233.206.211",
        "175.44.109.104",
        "118.212.104.240",
        "163.204.240.107",
        "60.13.42.77",
        "49.89.86.30",
        "106.42.217.26"
    ]
    return ips[Math.floor(Math.random() * ips.length)]
}


export function getArrRandomItem<T>(arr: T[]) {
    return arr[Math.floor(Math.random() * arr.length)] as T
}