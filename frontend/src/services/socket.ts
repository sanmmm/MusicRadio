import socketIoClient from 'socket.io-client'

import {ClientListenSocketEvents, ServerListenSocketEvents} from '@global/common/enums'
import settings from 'config/settings'
import globalConfigs from '@global/common/config'
import {getAuthToken, CustomAlert} from '@/utils'

namespace Io {
    const authToken = getAuthToken()
    export type Listener = (data) => any
    export interface SocketRes {
        data: any;
    }
    
    export const getScoketActionId = () => Date.now() + Math.random().toString(32).slice(2)
    export const getWaittingGetResponseKey = (actionId: string) => `waittingGetResponse:${actionId}`
    export const client = socketIoClient.connect(settings.socketServer || '/', {
        query: {
            [globalConfigs.authTokenFeildName]: authToken
        },
        autoConnect: false,
    })

    /**
     * 访问时间记录 单位ms
     */
    let isSuperAdmin = false
    const apiRequestTimeRecord = new Map<ServerListenSocketEvents, number>()
    export function checkRequsetFrequency (type: ServerListenSocketEvents) {
        if (isSuperAdmin) {
            return true
        }
        const lastRequestTime = apiRequestTimeRecord.get(type)
        const limit = globalConfigs.apiFrequeryLimit[type] || globalConfigs.apiFrequeryLimit.default
        if (lastRequestTime && (lastRequestTime + limit) > Date.now()) {
            return false    
        } 
        apiRequestTimeRecord.set(type, Date.now())
        return true
    }
    
    export function setIsSuperAdmin (value: boolean) {
        isSuperAdmin = value
    }
}

namespace WaittingQuene {
    const listenerMap = new Map<string, Function>()
    const failedTimerMap = new Map<string, NodeJS.Timeout>()

    export const pub = (key: string, ...data) => {
        const listener = listenerMap.get(key)
        if (listener) {
            const timer = failedTimerMap.get(key)
            timer && clearTimeout(timer)
            listenerMap.delete(key)
            failedTimerMap.delete(key)
            listener(...data)
        }
    }
    /**
     * 一次性订阅, 触发一次后即失效, 多次调用会覆盖之前调用
     * @param key  
     * @param func 回调函数
     * @param timeout 等待超时时间 单位毫秒
     */
    export const onceSub = (key: string, timeout = 8000) => {
        const hasExisted = listenerMap.has(key)
        if (hasExisted) {
            const timer = failedTimerMap.get(key)
            timer && clearTimeout(timer)
            listenerMap.delete(key)
            failedTimerMap.delete(key)
        }
        return new Promise((resolve, reject) => {
            const failedTimer = setTimeout(() => {
                listenerMap.delete(key)
                failedTimerMap.delete(key)
                reject(`waitting key: ${key} timeout`)
            }, timeout)

            listenerMap.set(key, resolve)
            failedTimerMap.set(key, failedTimer)
        })
    }
}

export default {
    client: Io.client,
    connect: () => {
        Io.client.connect()
    },
    disconnect: () => {
        Io.client.disconnect()
    },
    on: (eventType: ClientListenSocketEvents, listener: Io.Listener)  => {
        Io.client.on(eventType, (res: Io.SocketRes) => {
            const {data} = res
            listener(data)
        })
    },
    emit: (evenType: ServerListenSocketEvents, data: any) => {
        const flag = Io.checkRequsetFrequency(evenType)
        if (!flag) {
            CustomAlert('请不要频繁请求')
            throw new Error('请不要频繁请求') 
        }
        const actionStampId = Io.getScoketActionId()
        Io.client.emit(evenType, data, (res) => {
            console.log(res, 'res')
            const {data} = res
            WaittingQuene.pub(Io.getWaittingGetResponseKey(actionStampId), data)
        })
        return actionStampId
    },
    /**
     * @param timeout 单位毫秒/ 等待超时时间
     */
    awaitActionResponse: (actionStampId: string, timeout?: number) => {
        return WaittingQuene.onceSub(Io.getWaittingGetResponseKey(actionStampId), timeout)
    },
    setIsSuperAdmin (value: boolean) {
        Io.setIsSuperAdmin(value)
    }
}
