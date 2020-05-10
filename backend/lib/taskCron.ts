import uuidV4 from 'uuid/v4'
import Cron from 'cron'

import {CronTaskTypes} from 'root/type'
import redisCli from 'root/lib/redis'

const getTaskSetRedisKey = () => {
    return 'musicradio:cronTask'
}

const jobIdToObjMap = new Map<string, Cron.CronJob>()

interface TaskInfo<T = any> {
    taskId: string;
    taskType: CronTaskTypes;
    expireAt: number;
    data: T;
}

namespace expiredCronTaskQueue {
    const dataQueneMap: Map<string, Set<TaskInfo['data']>> = new Map()
    const cbMap: Map<string, cb> = new Map()
    
    function pushToDataQueneMap (type: CronTaskTypes, data: TaskInfo['data']) {
        let taskDataSet = dataQueneMap.get(type)
        if (!taskDataSet) {
            taskDataSet = new Set()
            dataQueneMap.set(type, taskDataSet)
        }
        taskDataSet.add(data)
        return taskDataSet
    }

    export type cb<T = any> = (data: TaskInfo<T>['data']) => any
    export function publish (type: CronTaskTypes, info: TaskInfo) {
        const cb = cbMap.get(type)
        if (!cb) {
            pushToDataQueneMap(type, info.data)
        }
        cb(info.data)
    }

    export function subscribe (type: CronTaskTypes, cb: cb) {
        cbMap.set(type, cb)
        const waittingTasks = (dataQueneMap.get(type) || new Set())
        waittingTasks.forEach(taskData => {
            cb(taskData)
            waittingTasks.delete(taskData)
        })
    }

    export function unsubscribe(type: CronTaskTypes) {
        cbMap.delete(type)
    }

}   

async function stopCronJob (taskId: string) {
    const findJob = jobIdToObjMap.get(taskId)
    if (findJob) {
        findJob.stop()
    }
    jobIdToObjMap.delete(taskId)
    await redisCli.hdel(getTaskSetRedisKey(), taskId)
}

function addCronJob(expireAt: number, taskInfo: TaskInfo) {
    const job = new Cron.CronJob(new Date(expireAt * 1000), async () => {
        const newlyInfo = JSON.parse(await redisCli.hget(getTaskSetRedisKey(), taskInfo.taskId))
        if (newlyInfo) {
            console.log(`cron task: ${taskInfo.taskType}/${taskInfo.taskId} arrived`)
            expiredCronTaskQueue.publish(taskInfo.taskType, newlyInfo)
        }
        await stopCronJob(taskInfo.taskId)
    }, null, true)
    jobIdToObjMap.set(taskInfo.taskId, job)
}

export async function init () {
    let cursor = 0, exisetdTaskList: TaskInfo[] = []
    do {
        const [nextCursor, resArr] = await redisCli.hscan(getTaskSetRedisKey(), cursor, 'count', 1000)
        cursor = Number(nextCursor)
        for (let i=0; i < resArr.length; i+=2) {
            const [field, value] = resArr.slice(i, i + 2)
            if (value) {
                const taskInfo: TaskInfo = JSON.parse(value)
                exisetdTaskList.push(taskInfo)
            }
        }
    } while (cursor !== 0 && !isNaN(cursor))
    exisetdTaskList.forEach(async (taskInfo) => {
        if (!taskInfo) {
            return
        }
        if (taskInfo.expireAt * 1000 <= Date.now()) {
            expiredCronTaskQueue.publish(taskInfo.taskType, taskInfo)
            await redisCli.hdel(getTaskSetRedisKey(), taskInfo.taskId)
            return
        }
        addCronJob(taskInfo.expireAt, taskInfo)
    })
}

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
    await stopCronJob(taskId)
}

export function listen<T= any>(type: CronTaskTypes, cb: expiredCronTaskQueue.cb) {
    expiredCronTaskQueue.subscribe(type, cb)
}

export function offListen (type: CronTaskTypes) {
    expiredCronTaskQueue.unsubscribe(type)
}
