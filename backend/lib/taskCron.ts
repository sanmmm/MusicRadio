import uuidV4 from 'uuid/v4'
import Cron from 'cron'

import {CronTaskTypes} from 'root/type'
import redisCli from 'root/lib/redis'

const getTaskSetRedisKey = () => {
    return 'musicradio:cronTask'
}

interface TaskInfo<T = any> {
    taskId: string;
    taskType: CronTaskTypes;
    expireAt: number;
    data: T;
}

namespace expiredCronTaskQueue {
    const dataQueneMap: Map<string, Set<TaskInfo>> = new Map()
    const cbMap: Map<string, cb> = new Map()
    
    function pushToDataQueneMap (type: CronTaskTypes, info: TaskInfo) {
        let taskDataSet = dataQueneMap.get(type)
        if (!taskDataSet) {
            taskDataSet = new Set()
            dataQueneMap.set(type, taskDataSet)
        }
        taskDataSet.add(info)
        return taskDataSet
    }

    export type cb<T = any> = (data: TaskInfo<T>['data']) => any
    export function publish (type: CronTaskTypes, info: TaskInfo) {
        const cb = cbMap.get(type)
        if (!cb) {
            pushToDataQueneMap(type, info)
        }
        cb(info)
    }

    export function subscribe (type: CronTaskTypes, cb: cb) {
        cbMap.set(type, cb)
        const waittingTasks = (dataQueneMap.get(type) || new Set())
        waittingTasks.forEach(taskInfo => {
            cb(taskInfo)
            waittingTasks.delete(taskInfo)
        })
    }

    export function unsubscribe(type: CronTaskTypes) {
        cbMap.delete(type)
    }

}   

function addCronJob(expireAt: number, taskInfo: TaskInfo) {
    new Cron.CronJob(new Date(taskInfo.expireAt * 1000), async () => {
        const newlyInfo = JSON.parse(await redisCli.hget(getTaskSetRedisKey(), taskInfo.taskId))
        if (!newlyInfo) {
            return
        }
        console.log(`cron task: ${taskInfo.taskType}/${taskInfo.taskId} arrived`)
        expiredCronTaskQueue.publish(taskInfo.taskType, newlyInfo)
    }, null, true)
}

async function init () {
    const existedTasks = await redisCli.hgetall(getTaskSetRedisKey())
    Object.entries(existedTasks).forEach(([key, value]) => {
        const taskInfo: TaskInfo = JSON.parse(value as string)
        if (!value || !taskInfo) {
            return
        }
        if (taskInfo.expireAt * 1000 <= Date.now()) {
            expiredCronTaskQueue.publish(taskInfo.taskType, taskInfo)
            return
        }
        addCronJob(taskInfo.expireAt, taskInfo)
    })
}

init()

export async function pushCronTask(taskType: CronTaskTypes, data: any, expire: number) {
    const taskId = uuidV4()
    const expireAt = (Date.now() / 1000) + expire
    const obj = {
        taskId,
        expireAt,
        data,
        taskType,
    }
    addCronJob(expireAt, obj)
    await redisCli.hset(getTaskSetRedisKey(), taskId, JSON.stringify(obj))
    return taskId as string
}

export async function cancelCaronTask(taskId: string) {
    await redisCli.hdel(getTaskSetRedisKey(), taskId)
}

export function listen<T= any>(type: CronTaskTypes, cb: expiredCronTaskQueue.cb) {
    expiredCronTaskQueue.subscribe(type, cb)
}

export function offListen (type: CronTaskTypes) {
    expiredCronTaskQueue.unsubscribe(type)
}
