import socketIo from 'socket.io'
import { Router, Request, Response } from 'express'
import Mint from 'mint-filter'
import got from 'got'
import express, { Express } from 'express'
import isDeepEqual from 'deep-equal'
import path from 'path'

import globalConfigs from 'global/common/config'
import settings from 'root/getSettings'
import { User, Room } from 'root/lib/models'
import * as NetEaseApi from 'root/lib/api'
import * as CronTask from 'root/lib/taskCron'
import redisCli from 'root/lib/redis'
import {emojiData, blockMusic as BlockMusicList, blockWords as BlockWordList} from 'root/getSettings'
import {
    UserModel, RoomModel, MessageItem, PlayListItem, MessageTypes, AdminAction,
    AdminActionTypes, RoomStatus, MediaTypes, CronTaskTypes, RoomTypes, UserRoomRecordTypes, UserRoomRecord,
    UserStatus
} from 'root/type'
import { ScoketStatus, NowPlayingStatus, RoomMusicPlayMode, ClientListenSocketEvents, ServerListenSocketEvents } from "global/common/enums"
import { catchError, isSuperAdmin, hideIp, safePushArrItem, safeRemoveArrItem, ResponseError, getArrRandomItem, useBlock, wait } from 'root/lib/utils'

async function beforeStart() {
    let hallRoom = await Room.findOne(hallRoomId), isInitial = false
    // 创建大厅房间
    if (!hallRoom) {
        isInitial = true
        hallRoom = new Room({
            id: hallRoomId,
            type: RoomTypes.hallRoom,
            banUsers: [],
            blockIps: [],
            blockUsers: [],
            name: '大厅',
        })
        await hallRoom.save()
    }
    // 加载所有房间id到内存
    await Room.loadAllMembers()
    // 初始化定时任务程序
    await CronTask.init()
    // 开启大厅定时任务
    if (isInitial) {
        await UtilFuncs.startRoomRoutineTasks(hallRoom)
    }
    await RoomIpActionDataRecord.start(settings.coordDataCalcDuration, settings.coordDataCalcIncMode)
}

const UserToSocketIdMap: {
    [userId: string]: string
} = {}

namespace ListenSocket {
    type Handler<T = any> = (socket: socketIo.Socket, data: T, ackFunc?: Function) => any
    interface RegisterOptions {
        useBlock?: {
            wait?: boolean;
            getKey: (eventName: string, socket: socketIo.Socket, data: any) => string;
        }
    }

    const map = new Map<string, Set<Handler>>()
    export function register(event: ServerListenSocketEvents, options: RegisterOptions = {}) {
        return (target, propertyName: string, descriptor: PropertyDescriptor) => {
            const prevFunc: Handler = descriptor.value
            const limitConfigs = globalConfigs.apiFrequeryLimit
            let funcSet = map.get(event)
            if (!funcSet) {
                funcSet = new Set()
                map.set(event, funcSet)
            }
            const newFunc = async function (data: any, ackFunc?: Function) {
                const socket: socketIo.Socket = this
                try {
                    if (socket.session.isAuthenticated) {
                        const user = await User.findOne(socket.session.user.id)
                        socket.session.user = user
                    }
                    if (ackFunc && typeof ackFunc === 'function') {
                        const oldAckFunc = ackFunc
                        ackFunc = (resData) => {
                            oldAckFunc({
                                eventName: event,
                                data: resData
                            })
                        }
                    }
                    const reqUser = socket.session.user
                    const isSuper = isSuperAdmin(reqUser)
                    // api截流
                    const throttleTime = limitConfigs[event] || limitConfigs.default || 0
                    if (!isSuper && (throttleTime > 0)) {
                        const throttleKey = `musicradio:api:${event}:throttle:${socket.session.id}`
                        const rejected = await redisCli.exists(throttleKey)
                        if (rejected) {
                            console.log(`session id: ${socket.session.id} request rejected`)
                            return
                        }
                        await redisCli.set(throttleKey, 'true', 'PX', throttleTime)
                    }
                    // api请求加锁
                    if (options.useBlock) {
                        const { getKey, wait = false } = options.useBlock
                        const blockKey = getKey(event, socket, data)
                        if (blockKey) {
                            useBlock(blockKey, {
                                wait,
                                success: prevFunc.bind(null, socket, data, ackFunc),
                                failed: () => {
                                    ackFunc && ackFunc({
                                        success: false,
                                    })
                                    Actions.notification([reqUser], '操作冲突', true)
                                }
                            })
                            return
                        }
                    }

                } catch (e) {
                    console.error(e)
                }
                prevFunc(socket, data, ackFunc)
            }
            funcSet.add(newFunc)
            descriptor.value = newFunc
            return descriptor as TypedPropertyDescriptor<Handler>
        }
    }

    export function listen(socket: socketIo.Socket) {
        map.forEach((funcSet, event) => {
            funcSet.forEach(handler => {
                socket.on(event, function (data, ...args) {
                    console.log(`inner socket event: ${event}`)
                    handler.call(this, data, ...args)
                })
            })
        })
    }

}

// 注册http请求路由
namespace HandleHttpRoute {
    type PathMatcher = string | RegExp
    type Methods = 'get' | 'post'
    const pathRouteHandlers: {
        method: Methods,
        route: PathMatcher,
        handler: (req, res, next) => any;
    }[] = []
    function register(method: Methods, route: PathMatcher) {
        return function (targer, propertyName, descriptor: PropertyDescriptor) {
            const handler = descriptor.value
            pathRouteHandlers.push({
                method,
                route,
                handler
            })
            return descriptor
        }
    }

    export function get(route: PathMatcher) {
        return register('get', route)
    }

    export function post(route: PathMatcher) {
        return register('post', route)
    }

    export function listen(app: Express) {
        const router = express.Router()
        pathRouteHandlers.forEach(item => {
            const matcher = router[item.method]
            matcher.call(router, item.route, item.handler)
        })
        app.use('/', router)
    }
}
namespace UtilFuncs {
    const IpToOnlineUsersMap: {
        [ip: string]: Set<string>
    } = {}

    export const SocketIdToSocketObjMap = new Map<string, socketIo.Socket>()

    const getIpUserIdSet = (ip: string) => {
        let set = IpToOnlineUsersMap[ip]
        if (!set) {
            set = new Set<string>()
            IpToOnlineUsersMap[ip] = set
        }
        return set
    }

    export function addUserIdToIp(ip: string, userId: string) {
        const ipSet = getIpUserIdSet(ip)
        ipSet.add(userId)
    }

    export function deleteUserIdOfIp(ip: string, userId: string) {
        const ipSet = getIpUserIdSet(ip)
        ipSet.delete(userId)
    }

    export function getIpOnlineUserIds(ip: string) {
        return Array.from(getIpUserIdSet(ip))
    }

    export async function destroyRoom(room: RoomModel) {
        await UtilFuncs.stopRoomRoutineTasks(room)
        await RoomRoutineLoopTasks.stopRoomTask(room, RoomRoutineLoopTasks.TaskTypes.broadcastRoomBaseInfo)
        const joinerSockets = room.joiners.map(uid => UserToSocketIdMap[uid])
        await room.remove()
        if (room.creator) {
            const creator = await User.findOne(room.creator)
            creator.createdRoom = null
            await creator.save()
        }
        const admins = await User.find(room.admins)
        await Promise.all(admins.map(admin => {
            admin.createdRoom = null
            return admin.save()
        }))
        Actions.updateSocketStatus(joinerSockets, ScoketStatus.roomDestroy)
        Actions.closeUsersScoket(room.joiners)
    }

    export function getRoomBaseInfo(room: RoomModel) {
        const { name, creator, heat, max, id, playMode, playModeInfo } = room
        return {
            id,
            name,
            creator,
            heat,
            max,
            playModeInfo,
        }
    }

    export function getUserNowSocketId(userId: string) {
        const socketId = UserToSocketIdMap[userId]
        return socketId
    }

    export function isUserBlocked(room: RoomModel, user: UserModel) {
        return !isSuperAdmin(user) && room.creator !== user.id && (room.blockIps.includes(user.ip) || room.blockUsers.includes(user.id))
    }

    export function isRoomAdmin(room: RoomModel, user: UserModel) {
        return isSuperAdmin(user) || room.creator === user.id || room.admins.includes(user.id)
    }

    // 该manager是否拥有对aimuser的管理权限
    export function isManageableUser(room: RoomModel, manager: UserModel, aimUser: UserModel) {
        if (isSuperAdmin(aimUser) || room.creator === aimUser.id) {
            return false
        }
        if (!isRoomAdmin(room, manager)) {
            return false
        }
        const [managerRecord, aimUserRecord] = User.getUserRoomRecords([manager.id, aimUser.id])
        const isInRoom = !!aimUserRecord && (aimUserRecord.nowRoomId === room.id)
        if (!isInRoom) {
            return true
        }
        return managerRecord.type > aimUserRecord.type
    }

    export function isInRoom(room: RoomModel, user: UserModel) {
        return user.append.nowRoomId === room.id
    }

    export async function quitRoom(room: RoomModel, user: UserModel) {
        if (user.append.nowRoomId !== room.id) {
            throw new ResponseError('退出错误，不在该房间中')
        }
        if (user.append.type === UserRoomRecordTypes.creator) {
            throw new ResponseError('创始人请先销毁房间')
        }
        room.quit(user)
        if (user.managedRoom) {
            user.managedRoom = null
            await user.save()
        }
    }

    export function socketApiCatchError() {
        return catchError((e: Error, socket: socketIo.Socket, data: any, ackFunc: Function) => {
            try {
                let message = '', isGlobal = true
                if (e instanceof ResponseError) {
                    message = e.message
                    isGlobal = e.isGlobal
                }
                socket.emit(ClientListenSocketEvents.notification, {
                    data: {
                        isGlobal,
                        message: message || '请求错误'
                    }
                })
                ackFunc && ackFunc({
                    success: false
                })
            } catch (e) {
                console.log('resolve api handler error response failed')
                console.error(e)
            }
        })
    }

    export function routeHandlerCatchError() {
        return catchError((e: Error, req: Request, res: Response) => {
            res.json({
                code: -1,
                msg: (e instanceof ResponseError && e.message) || '未知错误'
            })
        })
    }

    export function extractUserInfo(user: UserModel) {
        const { id, isSuperAdmin, name, blockPlayItems, status } = user
        const { nowRoomId, nowRoomName, type: userRoomRecordType, allowComment, nowRoomToken, nowRoomPassword } = user.append
        const userInfo = {
            id,
            status,
            isSuperAdmin,
            name,
            blockPlayItems,
            allowComment,
            nowRoomId,
            nowRoomName,
            nowRoomToken,
            nowRoomPassword,
            userRoomRecordType,
            isRoomCreator: userRoomRecordType === UserRoomRecordTypes.creator,
        }
        return userInfo
    }

    const getFlatSearchTree = (searchTree) => {
        const fieldNames = Object.keys(searchTree)
        const arr = []
        fieldNames.forEach(fieldName => {
            const value = searchTree[fieldName]
            const valueType = typeof value
            if (valueType === 'object') {
                const flatTree = getFlatSearchTree(value)
                flatTree.forEach(fieldNameArr => arr.push([fieldName, ...fieldNameArr]))
            } else if (value === true) {
                arr.push([fieldName])
            }
        })
        return arr
    }

    type SearchTreeType<T> = Partial<{
        [key in keyof T]: SearchTreeType<T[key]> | boolean
    }>
    export function searchValueFromObj<T>(objs: T[], searchTree: SearchTreeType<T>, searchStr, cb: (obj: T, isMatched: boolean) => any) {
        if (typeof searchTree !== 'object') {
            throw new Error('invalid searchtree')
        }
        const flatSearchTree = getFlatSearchTree(searchTree)
        objs.forEach(obj => {
            const isMatched = flatSearchTree.some(keyArr => {
                const searchValue = keyArr.reduce((obj, key) => {
                    return obj && obj[key]
                }, obj)
                if (!!searchValue && searchValue.includes(searchStr)) {
                    return true
                }
                return false
            })
            cb(obj, isMatched)
        })
    }

    export function updateUserRoomRecordObj(user: UserModel, obj: Partial<UserRoomRecord>) {
        if (!user.append.nowRoomId) {
            return
        }
        const userId = user.id
        const updatedRecord = User.updateUserRoomRecords(userId, obj)
        const nowRoomId = updatedRecord.nowRoomId
        const map = Room.getRoomUpdatedUserRecords(nowRoomId)
        map.set(userId, updatedRecord)
    }

    export async function startRoomRoutineTasks(room: RoomModel) {
        const {broadcastRoomBaseInfo, checkCreatorOnlineStatus, dispatchUpatedOnlineUsersToAdmin} = RoomRoutineLoopTasks.TaskTypes
        await RoomRoutineLoopTasks.startRoomTask({
            room,
            taskType: broadcastRoomBaseInfo,
            period: 60
        })
        await RoomRoutineLoopTasks.startRoomTask({
            room,
            taskType: dispatchUpatedOnlineUsersToAdmin,
            period: 20,
        })
        if (room.type === RoomTypes.personal) {
            await RoomRoutineLoopTasks.startRoomTask({
                room,
                taskType: checkCreatorOnlineStatus,
                period: 60
            })
        }
    }

    export async function stopRoomRoutineTasks(room: RoomModel) {
        await RoomRoutineLoopTasks.stopRoomTask(room, RoomRoutineLoopTasks.TaskTypes.broadcastRoomBaseInfo)
        await RoomRoutineLoopTasks.stopRoomTask(room, RoomRoutineLoopTasks.TaskTypes.dispatchUpatedOnlineUsersToAdmin)
        if (room.type === RoomTypes.personal) {
            await RoomRoutineLoopTasks.stopRoomTask(room, RoomRoutineLoopTasks.TaskTypes.checkCreatorOnlineStatus)
        }
    }

    export function checkIsAutoPlayMode(room: RoomModel, actionName: string = '该操作') {
        if (room.playMode === RoomMusicPlayMode.auto) {
            throw new ResponseError(`当前为自动随机播放模式, 不支持${actionName}`)
        }
    }

    export function getRoomPlayInfoFromMsg(obj) {
        const { mode, autoPlayType } = obj
        if (mode === RoomMusicPlayMode.demand) {
            return {
                mode,
            }
        }
        if (mode === RoomMusicPlayMode.auto) {
            return {
                autoPlayType,
                mode
            }
        }
    }

    // 超级管理员注册码（一次性）
    const superAdminTokenRedisKey = 'musicradio:superadmintokens'
    export async function validateSuperAdminToken(token: string) {
        if (!settings.superAdminRegisterTokens.includes(token)) {
            return false
        }
        const used = await redisCli.sismember(superAdminTokenRedisKey, token)
        return !used
    }

    export async function useSuperAdminToken(token: string) {
        await redisCli.sadd(superAdminTokenRedisKey, token)
    }

    // 敏感词验证
    const WordFilter = settings.openWordValidate ? new Mint(Array.isArray(BlockWordList) ? BlockWordList : []) : null
    export async function validateText(str: string) {
        if (!settings.openWordValidate) {
            return true
        }
        return WordFilter.validator(str)
    }

    export function getRenderAdminPageData(user: UserModel) {
        return {
            user: user && {
                ...user,
                password: undefined
            },
            httpServerUrl: settings.httpServer || '',
            basePath: '/admin',
        }
    }

    // 从头顺序播放房间播放列表
    export async function startPlayFromPlayListInOrder(room: RoomModel, autoPlay = true) {
        if (!room.playList.length) {
            throw new Error(`房间:${room.id}播放列表为空`)
        }
        await ManageRoomPlaying.initPlaying(room, room.playList[0], autoPlay)
    }

    export async function recordFuctionArguments(key: string | number, ...newArgs: any[]) {
        const redisKey = `musicradio:function:${key}:args`
        const lastRecord = await redisCli.safeGet(redisKey)
        const isChanged = !isDeepEqual(lastRecord, newArgs)
        if (isChanged) {
            await redisCli.safeSet(redisKey, newArgs, 3600 * 24 * 356)
        }
        return isChanged
    }
}

// 全站房间可视化数据记录和处理
namespace RoomIpActionDataRecord {
    enum SubCronTaskTypes {
        calcData, // 计算整理数据
        refreshIpReqCounter, // 刷新ip-data api请求计数
    }
    interface IpBaseInfo {
        ip: string;
        country: string;
        countryCode: string;
        region: string;
        regionName: string;
        city: string;
        lat: number;
        lon: number;
    }

    interface IpDataDef {
        ip: string;
        updateAt: number; // 更新时间 时间戳
        info: IpBaseInfo;
        heat: number;
        musicList: {
            name: string;
            id: string;
            roomId: string;
        }[];
        messages: {
            content: string;
            id: string;
            roomId: string;
        }[];
    }
    interface CalculatedCoordData {
        lat: number;
        lon: number;
        heat: number;
        region: string;
        regionName: string;
        musicList: {
            id: string;
            name: string;
            roomId: string;
        }[];
        messages: {
            id: string;
            content: string;
            roomId: string;
        }[];
    }
    const ipDataMap = new Map<string, IpDataDef>()
    const resolvedIps = new Set<string>()
    const ipToDataHashKey = 'musicradio:ipToDataHash'
    const roomCoordDataCacheKey = 'musicradio:roomCoordDataCache'
    const queryApiLimitPerSecond = 40
    const vars = {
        isStarted: false,
        // 计算完成得到的ipData 缓存
        roomCoordData: [] as CalculatedCoordData[]
    }

    namespace IpDataCronTaskManage {

        export interface IpDataCronTaskData {
            subTaskType: SubCronTaskTypes;
            extra?: any;
            taskExpire: number;
        }

        const getTaskIdRedisKey = (taskType) => {
            return `musicradio:ipdata:taskId:${taskType}`
        }

        export async function startTask(taskType: SubCronTaskTypes, expire: number, extraData = null) {
            const taskId = await redisCli.get(getTaskIdRedisKey(taskType))
            if (taskId) {
                return
            }
            const data: IpDataCronTaskData = {
                subTaskType: taskType,
                extra: extraData,
                taskExpire: expire,
            }
            const freshTaskId = await CronTask.pushCronTask(CronTaskTypes.roomIpDataTask, data, expire)
            await redisCli.set(getTaskIdRedisKey(taskType), freshTaskId, 'EX', expire)
        }

        export async function stopTask(taskType: SubCronTaskTypes) {
            const redisKey = getTaskIdRedisKey(taskType)
            const taskId = await redisCli.get(redisKey)
            if (!taskId) {
                return
            }
            await CronTask.cancelCaronTask(taskId)
            await redisCli.del(redisKey)
        }

        export function registerListener(cb: (data: IpDataCronTaskData) => any) {
            CronTask.listen(CronTaskTypes.roomIpDataTask, async (data: IpDataCronTaskData) => {
                try {
                    const { subTaskType, taskExpire, extra } = data
                    await stopTask(subTaskType)
                    await startTask(subTaskType, taskExpire, extra)
                    await cb(data)
                } catch (e) {
                    console.error(e)
                }
            })
        }
    }

    namespace IpDataApiManage {
        const vars = {
            reqApiCounter: queryApiLimitPerSecond,
        }
        const notResolvedIpSet = new Set<string>()

        async function reqIpBaseInfo(ip: string) {
            const preCheck = () => {
                if (vars.reqApiCounter <= 0) {
                    throw new Error('超出api请求次数额度')
                }
                vars.reqApiCounter--
            }
            try {
                preCheck()
                const res = await got(`http://ip-api.com/json/${ip}`, {
                    query: {
                        lang: 'zh-CN',
                        fields: 'status,message,country,countryCode,region,regionName,city,lat,lon',
                    },
                    json: true,
                    retry: 2,
                    hooks: {
                        beforeRetry: [
                            (options, error, retryCount) => {
                                console.error(error)
                                preCheck()
                            }
                        ]
                    }
                })
                const { status, message, country, countryCode, region, regionName, city, lat, lon } = res.body
                if (status !== 'success') {
                    throw new Error('api返回错误:' + message)
                }
                const info = {
                    ip,
                    country,
                    countryCode,
                    region,
                    regionName,
                    city,
                    lat,
                    lon,
                }
                return info
            } catch (e) {
                console.error(e)
                return null
            }
        }

        class Funcs {
            @catchError()
            static async handleRefreshApiReqCounter() {
                vars.reqApiCounter = queryApiLimitPerSecond
                if (!!notResolvedIpSet.size) {
                    const ips = [...notResolvedIpSet].slice(0, vars.reqApiCounter)
                    const requests = ips.map(ip => handleReqIpBaseInfo(ip))
                    await Promise.all(requests)
                }
            }
            @catchError()
            static async handleReqIpBaseInfo(ip: string) {
                const info = await reqIpBaseInfo(ip)
                if (!info) {
                    await deleteIpData(ip)
                    return
                }
                notResolvedIpSet.delete(info.ip)
                if (info.countryCode === 'CN') {
                    await setIpData(ip, {
                        info,
                    })
                }
            }
        }

        const { handleReqIpBaseInfo } = Funcs

        export const { handleRefreshApiReqCounter } = Funcs

        export function getIpBaseInfo(ip: string) {
            notResolvedIpSet.add(ip)
            if (vars.reqApiCounter > 0) {
                setTimeout(() => {
                    handleReqIpBaseInfo(ip)
                }, 0)
            }
        }

    }

    async function loadDataFromRedis() {
        console.log('start load ipdata')
        const coordData = JSON.parse(await redisCli.get(roomCoordDataCacheKey))
        vars.roomCoordData = coordData
        let cursor = 0
        do {
            const [nextCursor, ipDataStrList] = await redisCli.hscan(ipToDataHashKey, cursor, 'count', 1000)
            cursor = Number(nextCursor)
            for (let i = 0; i < ipDataStrList.length; i += 2) {
                const [ip, ipDataStr] = ipDataStrList.slice(i, i + 2)
                const obj: IpDataDef = JSON.parse(ipDataStr)
                ipDataMap.set(obj.ip, obj)
                if (obj.info) {
                    resolvedIps.add(obj.ip)
                } else {
                    IpDataApiManage.getIpBaseInfo(obj.ip)
                }
            }
        } while (!isNaN(cursor) && cursor !== 0)
        console.log('load room ipdata success!')
    }

    async function setIpData(ip: string, data: Partial<IpDataDef>) {
        if (!ip) {
            throw new Error('invalid ip:' + ip)
        }
        const ipData = getIpData(ip)
        Object.assign(ipData, data)
        ipData.updateAt = Date.now()
        const needResolved = !ipData.info
        if (needResolved) {
            IpDataApiManage.getIpBaseInfo(ip)
        } else {
            resolvedIps.add(ip)
        }
        ipDataMap.set(ip, ipData)
        await redisCli.hset(ipToDataHashKey, ip, JSON.stringify(ipData))
    }

    function getIpData(ip: string) {
        return ipDataMap.get(ip) || {
            ip,
            updateAt: Date.now(),
            info: null,
            heat: 0,
            musicList: [],
            messages: [],
        }
    }

    async function deleteIpData(ip: string) {
        ipDataMap.delete(ip)
        resolvedIps.delete(ip)
        await redisCli.hdel(ipToDataHashKey, ip)
    }

    // 数据计算整理分析
    async function calcIpData(expire: number, inc = false) {
        let map = new Map<string, CalculatedCoordData>()
        Array.from(resolvedIps).forEach(ip => {
            const ipData = ipDataMap.get(ip)
            if (!ipData.info) {
                return
            }
            const { lat, lon, region, regionName, } = ipData.info
            const { heat, musicList, messages } = ipData
            const mapKey = `${lat}/${lon}`
            let coordData = map.get(mapKey)
            if (!coordData) {
                coordData = {
                    lon,
                    lat,
                    heat: 0,
                    region,
                    regionName,
                    musicList: [],
                    messages: [],
                }
            }
            coordData.heat += heat
            coordData.musicList = coordData.musicList.concat(musicList)
            coordData.messages = coordData.messages.concat(messages)
            map.set(mapKey, coordData)
        })
        const arrayData = Array.from(map.keys()).map(key => map.get(key))
        vars.roomCoordData = arrayData
        await redisCli.set(roomCoordDataCacheKey, JSON.stringify(arrayData), 'EX', expire)
        if (!inc) {
            // 非增量更新，清除数据
            let pipe = redisCli.pipeline();
            let count = 0, resArr = []
            const ipArr = [...resolvedIps]
            for (let ip of ipArr) {
                count++
                resolvedIps.delete(ip)
                ipDataMap.delete(ip)
                pipe.hdel(ipToDataHashKey, ip)
                const isLastIp = ip === ipArr[ipArr.length - 1]
                if (count >= 1000 || isLastIp) {
                    const res = await pipe.exec()
                    resArr = resArr.concat(res)
                    count = 0
                    pipe = redisCli.pipeline()
                }
            }
            resArr.forEach(res => {
                const [error] = res
                if (error) {
                    throw error
                }
            })
        }
    }

    class Handlers {
        @catchError()
        static async handleIpDataCrontTaskArrived(data: IpDataCronTaskManage.IpDataCronTaskData) {
            const { subTaskType } = data
            if (subTaskType === SubCronTaskTypes.calcData) {
                const { extra } = data
                await calcIpData(extra.expire, extra.inc)
            } else if (subTaskType === SubCronTaskTypes.refreshIpReqCounter) {
                await IpDataApiManage.handleRefreshApiReqCounter()
            }
        }

        @catchError()
        static async userConnected(user: UserModel) {
            if (!vars.isStarted) {
                return
            }
            const ip = user.ip
            const ipData = getIpData(ip)
            ipData.heat += 1
            await setIpData(ip, ipData)
        }
        @catchError()
        static async playMusics(user: UserModel, musics: PlayListItem[]) {
            if (!vars.isStarted) {
                return
            }
            const ip = user.ip
            const ipData = getIpData(ip)
            musics.forEach(music => {
                ipData.musicList.push({
                    name: music.name,
                    id: music.id,
                    roomId: user.append.nowRoomId
                })
            })
            await setIpData(ip, ipData)
        }
        @catchError()
        static async sendTextMessage(user: UserModel, message: MessageItem) {
            if (!vars.isStarted) {
                return
            }
            if (![MessageTypes.advanced, MessageTypes.normal].includes(message.type)) {
                return
            }
            const ip = user.ip
            const ipData = getIpData(ip)
            ipData.messages.push({
                content: message.content.text,
                id: message.id,
                roomId: user.append.nowRoomId
            })
            await setIpData(ip, ipData)
        }

        /**
         * 
         * @param hallRoom 
         * @param refreshDuration 数据计算结果刷新周期 单位 秒
         * @param inc 是否为增量更新 
         */
        @catchError()
        static async start(refreshDuration: number, inc = false) {
            const args = [refreshDuration, inc]
            if (await UtilFuncs.recordFuctionArguments('startcalcipdata', args)) {
                await stop()
            } else {
                if (vars.isStarted) {
                    return
                }
            }
            await loadDataFromRedis()
            await IpDataCronTaskManage.startTask(SubCronTaskTypes.calcData, refreshDuration, {
                expire: refreshDuration,
                inc,
            })
            await IpDataCronTaskManage.startTask(SubCronTaskTypes.refreshIpReqCounter, 60)
            vars.isStarted = true
        }
        @catchError()
        static async stop() {
            await IpDataCronTaskManage.stopTask(SubCronTaskTypes.calcData)
            await IpDataCronTaskManage.stopTask(SubCronTaskTypes.refreshIpReqCounter)
            vars.isStarted = false
        }
    }

    const { handleIpDataCrontTaskArrived } = Handlers
    IpDataCronTaskManage.registerListener(handleIpDataCrontTaskArrived)

    export const { start, stop, userConnected, playMusics, sendTextMessage } = Handlers
    export function getRoomCoordData() {
        return vars.roomCoordData
    }
}

namespace DestroyRoom {
    const getRoomRecordKey = (roomId: string) => {
        return `musicraio:roomdestroy:${roomId}`
    }

    interface DestroyRecord {
        cronJobId: string;
        prevRoomStatus: RoomStatus;
    }

    interface cronData {
        roomId: string
    }

    class UtilFunc {
        @catchError()
        static async handleDestroy(data: cronData) {
            const { roomId } = data
            const room = await Room.findOne(roomId)
            await UtilFuncs.destroyRoom(room)
            const creator = await User.findOne(room.creator)
            if (!creator) {
                return
            }
            creator.createdRoom = null
            await creator.save()
        }
    }

    CronTask.listen(CronTaskTypes.destroyRoom, UtilFunc.handleDestroy)

    export async function destroy(room: RoomModel, expire: number = 60 * 5) {
        const cronData: cronData = {
            roomId: room.id
        }
        const destoryExpire = expire
        const redisKey = getRoomRecordKey(room.id)
        const oldJobRecord: DestroyRecord = await redisCli.safeGet(redisKey)
        if (oldJobRecord) {
            await CronTask.cancelCaronTask(oldJobRecord.cronJobId)
            await redisCli.del(redisKey)
        }
        const jobId = await CronTask.pushCronTask(CronTaskTypes.destroyRoom, cronData, destoryExpire)
        await redisCli.safeSet(redisKey, {
            cronJobId: jobId,
            prevRoomStatus: room.status
        }, destoryExpire)
        room.status = RoomStatus.willDestroy
        await room.save()
        return room
    }

    export async function cancelDestroy(room: RoomModel) {
        if (room.status !== RoomStatus.willDestroy) {
            return
        }
        const redisKey = getRoomRecordKey(room.id)
        const record: DestroyRecord = await redisCli.safeGet(redisKey)
        if (!record) {
            return
        }
        await CronTask.cancelCaronTask(record.cronJobId)
        await redisCli.del(redisKey)
        room.status = record.prevRoomStatus
        await room.save()
        return room
    }
}

namespace RoomRoutineLoopTasks {
    const getTaskToCronJobIdKey = (roomId: string, taskType: TaskTypes) => `musicradio:room:routinetask:${roomId}:${taskType}`

    const taskCbMap: Map<TaskTypes, Function> = new Map()
    interface CronData {
        roomId: string;
        routineTaskType: TaskTypes;
        period: number; // 循环周期时长
        extra?: any;
    }

    export enum TaskTypes {
        broadcastRoomBaseInfo,
        dispatchUpatedOnlineUsersToAdmin,
        checkCreatorOnlineStatus,
    }


    function registerTaskCb(taskType: TaskTypes) {
        return function (target, propertyName, descriptor: PropertyDescriptor) {
            const func = descriptor.value
            taskCbMap.set(taskType, func)
            return descriptor
        }
    }

    class Handler {

        @catchError()
        static async main(data: CronData) {
            const taskType = data.routineTaskType
            const cb = taskCbMap.get(taskType)
            if (cb) {
                await cb(data)
            }
            const taskId = await CronTask.pushCronTask(CronTaskTypes.roomRoutineTask, data, data.period)
            await redisCli.set(getTaskToCronJobIdKey(data.roomId, data.routineTaskType), taskId)
        }

        @registerTaskCb(TaskTypes.broadcastRoomBaseInfo)
        @catchError()
        static async handleBroadcastRoomBaseInfo(data: CronData) {
            const { roomId, period } = data
            const room = await Room.findOne(roomId)
            Actions.updateRoomBaseInfo(room.joiners, UtilFuncs.getRoomBaseInfo(room))
        }

        @registerTaskCb(TaskTypes.dispatchUpatedOnlineUsersToAdmin)
        @catchError()
        static async handleDisptachUpdatedUserRecordsToAdmin(data: CronData) {
            const { roomId } = data
            const room = await Room.findOne(roomId)
            const updatedMap = Room.getRoomUpdatedUserRecords(roomId)
            const updatedUserRecords = Array.from(updatedMap.values())
            if (updatedUserRecords.length) {
                Actions.updateOnlineUsersInfo(room.admins, updatedUserRecords)
            }
            Room.clearRoomUpdatedUserRecords(roomId)
        }

        @registerTaskCb(TaskTypes.checkCreatorOnlineStatus)
        @catchError()
        static async handleCheckRoomCreatorOnlineStatus(data: CronData) {
            const { roomId } = data
            const room = await Room.findOne(roomId)
            if (room.type === RoomTypes.personal) {
                const socket = UserToSocketIdMap[room.creator]
                if (!socket) {
                    DestroyRoom.destroy(room)
                }
            }
        }

    }

    CronTask.listen(CronTaskTypes.roomRoutineTask, Handler.main)



    /**
     * 
     * @param room 房间
     * @param taskType 循环任务类型
     * @param period 循环任务周期 单位: s
     */
    interface StartRoomtTaskOptions {
        room: RoomModel;
        taskType: TaskTypes;
        period: number;
        extraData?: any;
    }
    export async function startRoomTask(options: StartRoomtTaskOptions) {
        const { room, taskType, period, extraData = null } = options
        const redisKey = getTaskToCronJobIdKey(room.id, taskType)

        const args = [room.id, taskType, period, extraData]
        if (await UtilFuncs.recordFuctionArguments(`roomroutineTask:${taskType}`, args)) {
            await stopRoomTask(room, taskType)
        } else {
            const isStarted = await redisCli.exists(redisKey)
            if (isStarted) {
                return
            }
        }
        const cronData: CronData = {
            roomId: room.id,
            routineTaskType: taskType,
            period,
        }
        if (extraData) {
            cronData.extra = extraData
        }
        const jobId = await CronTask.pushCronTask(CronTaskTypes.roomRoutineTask, cronData, period)
        await redisCli.set(redisKey, jobId)
    }

    export async function stopRoomTask(room: RoomModel, taskType: TaskTypes) {
        const redisKey = getTaskToCronJobIdKey(room.id, taskType)
        const jobId = await redisCli.get(redisKey)
        if (!jobId) {
            return
        }
        await CronTask.cancelCaronTask(jobId)
        await redisCli.del(redisKey)
    }
}

namespace ManageRoomPlaying {
    interface CronJobData {
        roomId: string;
        musicId: string;
    }

    const getRoomToJobIdKey = (roomId: string) => `musicradio:playing:${roomId}`

    class UtilFunc {
        // 上一首播放结束后按照播放列表自动切换
        @catchError()
        static async handleSwitchPlaying(data: CronJobData) {
            const { roomId, musicId } = data
            const room = await Room.findOne(roomId)
            if (!(room.nowPlayingInfo && room.nowPlayingInfo.id === musicId)) {
                return
            }
            await switchRoomPlaying(room)
            
        }

    }

    async function setSwitchMusicCronJob(room: RoomModel) {
        const jobIdRedisKey = getRoomToJobIdKey(room.id)
        const oldJobId = await redisCli.get(jobIdRedisKey)
        if (oldJobId) {
            await CronTask.cancelCaronTask(oldJobId)
            await redisCli.del(jobIdRedisKey)
        }

        const { progress, duration } = room.nowPlayingInfo
        const leftSecond = (1 - progress) * duration
        const data: CronJobData = {
            roomId: room.id,
            musicId: room.nowPlayingInfo.id
        }
        // 播放进度为100% 或极度接近100%, 结束播放
        if (leftSecond < 0.3) {
            UtilFunc.handleSwitchPlaying(data)
            return
        }
        const newlyjobId = await CronTask.pushCronTask(CronTaskTypes.cutMusic, data, leftSecond)
        await redisCli.safeSet(jobIdRedisKey, newlyjobId, Math.ceil(leftSecond))
    }

    async function cancelSwitchMusicJob(room: RoomModel) {
        const jobIdRedisKey = getRoomToJobIdKey(room.id)
        const jobId = await redisCli.safeGet(jobIdRedisKey)
        if (!jobId) {
            return
        }
        await CronTask.cancelCaronTask(jobId)
        await redisCli.del(jobIdRedisKey)
    }

    CronTask.listen<CronJobData>(CronTaskTypes.cutMusic, UtilFunc.handleSwitchPlaying)

    export async function switchRoomPlaying (room: RoomModel) {
        if (!Object.values(RoomMusicPlayMode).includes(room.playMode)) {
            throw new Error('invlid play mode' + room.playMode)
        }
        if (room.playMode === RoomMusicPlayMode.demand) {
            await removeNowPlaying(room)
            const leftPlayList = room.playList
            if (!leftPlayList.length) {
                console.log(`房间: ${room.id}列表播放结束`)
                return
            }
            await UtilFuncs.startPlayFromPlayListInOrder(room)
        } else if (room.playMode === RoomMusicPlayMode.auto) {
            await removeNowPlaying(room, false)
            const selected = getArrRandomItem(room.playList)
            await ManageRoomPlaying.initPlaying(room, selected)
        } else {
            return
        }
    }

    export async function getPlayItemDetailInfo(playItemId: string) {
        const [musicInfo] = await NetEaseApi.getMusicInfo([playItemId])
        const { id, name, artist, lyric, src, pic, duration, comments } = musicInfo
        let selectedComment = null, lineCount = 0
        comments.forEach((c, index) => { // 选取换行符最少的评论
            const nowLineCount = c.content.split('\n').length
            if (index === 0 || nowLineCount < lineCount) {
                selectedComment = c
                selectedComment.content = c.content.replace(/\n|\s{2,}/g, ' ')
                lineCount = nowLineCount
            }
        })
        const comment = selectedComment;
        const nowPlayingInfo: RoomModel['nowPlayingInfo'] = {
            id,
            timestamp: Date.now(),
            status: NowPlayingStatus.paused,
            name,
            artist,
            lyric,
            src,
            pic,
            progress: 0,
            duration,
            endAt: null,
            comment,
        }
        return nowPlayingInfo
    }

    const getNowPlayingBaseInfo = (playListItem: PlayListItem) => {
        const { name, artist, duration, id, } = playListItem
        const baseInfo = {
            id,
            name,
            artist,
            duration,
            status: NowPlayingStatus.preloading,
            progress: 0,
            endAt: null,
            timestamp: Date.now(),
        }
        return baseInfo
    }

    export const isPlayDataLoaded = (room: RoomModel) => !!room.nowPlayingInfo && room.nowPlayingInfo.status !== NowPlayingStatus.preloading

    export const isRoomPlaying = (room: RoomModel) => room.nowPlayingInfo && room.nowPlayingInfo.status === NowPlayingStatus.playing

    export const isRoomPaused = (room: RoomModel) => room.nowPlayingInfo && room.nowPlayingInfo.status === NowPlayingStatus.paused


    export async function removeNowPlaying(room: RoomModel, removeFromPlayList = true) {
        const { nowPlayingInfo, playList } = room
        if (!nowPlayingInfo) {
            return
        }
        if (isRoomPlaying(room)) {
            await cancelSwitchMusicJob(room)
        }
        if (removeFromPlayList) {
            const firstPlayListItemId = playList.length ? playList[0].id : null
            if (nowPlayingInfo.id === firstPlayListItemId) {
                const deletedItem = room.playList.shift()
                Actions.deletePlayListItems(room.joiners, [deletedItem.id])
            }
        }
        room.nowPlayingInfo = null
        room.vote = null
        await room.save()
        Actions.updateRoomCutMusicVoteInfo(room, room.joiners)
        Actions.sendNowRoomPlayingInfo(room, room.joiners)
    }

    export async function initPlaying(room: RoomModel, playItem: PlayListItem, autoPlay = true) {
        // init music data
        room.nowPlayingInfo = getNowPlayingBaseInfo(playItem)
        await room.save()
        Actions.sendNowRoomPlayingInfo(room, room.joiners)
        // load music data
        room.nowPlayingInfo = await getPlayItemDetailInfo(playItem.id)
        await room.save()
        Actions.sendNowRoomPlayingInfo(room, room.joiners)
        if (autoPlay) {
            await startPlaying(room)
        }
    }

    export async function startPlaying(room: RoomModel) {
        if (!isPlayDataLoaded(room)) {
            throw new Error('room play data not loaded!')
        }
        if (isRoomPlaying(room)) {
            return
        }
        const nowPlayingInfo: RoomModel['nowPlayingInfo'] = room.nowPlayingInfo

        const { duration, progress = 0, pausedAt, id: playItemId } = nowPlayingInfo
        // 暂停时间过长导致播放链接失效，在此重新获取更新
        if (Date.now() / 1000 - pausedAt > 60 * 5) {
            const { src } = await getPlayItemDetailInfo(playItemId)
            nowPlayingInfo.src = src
        }

        const endAt = Date.now() / 1000 + (duration * (1 - progress))
        Object.assign(room.nowPlayingInfo, {
            endAt,
            status: NowPlayingStatus.playing,
            pausedAt: null,
        })
        room.updateProperty('nowPlayingInfo')
        await room.save()
        await setSwitchMusicCronJob(room)
        Actions.sendNowRoomPlayingInfo(room, room.joiners)
    }

    export async function pausePlaying(room: RoomModel) {
        if (!isPlayDataLoaded(room)) {
            throw new Error('音乐信息未加载完成! 无法操作暂停!')
        }
        await cancelSwitchMusicJob(room)
        const { duration, endAt } = room.nowPlayingInfo
        const leftTime = endAt - Date.now() / 1000
        if (leftTime < 0) {
            throw new Error('invalid expireAt')
        }
        Object.assign(room.nowPlayingInfo, {
            status: NowPlayingStatus.paused,
            progress: ((duration - leftTime) / duration).toFixed(2),
            endAt: null,
            pausedAt: Date.now() / 1000,
        })
        room.updateProperty('nowPlayingInfo')
        await room.save()
        Actions.sendNowRoomPlayingInfo(room, room.joiners)
    }

    export async function changePlayingProgress(room: RoomModel, progressRate: number) {
        if (!isPlayDataLoaded(room)) {
            throw new Error('音乐信息未加载完成! 无法操作')
        }
        if (progressRate > 1 || progressRate < 0) {
            throw new Error('invalid progress rate')
        }
        await cancelSwitchMusicJob(room)
        room.nowPlayingInfo.progress = progressRate
        room.updateProperty('nowPlayingInfo')
        await room.save()
        if (isRoomPlaying(room)) {
            const { progress, duration } = room.nowPlayingInfo
            room.nowPlayingInfo.endAt = Date.now() / 1000 + (1 - progress) * duration
            room.updateProperty('nowPlayingInfo')
            await room.save()
            await setSwitchMusicCronJob(room)
        }
        Actions.sendNowRoomPlayingInfo(room, room.joiners)
        return room.nowPlayingInfo.endAt
    }
}

class Actions {
    static usersToSocketIds(users: (UserModel | string)[]) {
        return users.map(user => UserToSocketIdMap[typeof user === 'string' ? user : user.id])
    }
    static emit(users: (UserModel | string)[], eventName: string, data: any) {
        const socketIds = Actions.usersToSocketIds(users)
        socketIds.forEach(id => {
            const socket = UtilFuncs.SocketIdToSocketObjMap.get(id)
            socket && socket.emit(eventName, data)
        })
    }
    @catchError()
    static sendNowRoomPlayingInfo(room: RoomModel, users: (UserModel | string)[]) {
        const sendData = {
            data: room.nowPlayingInfo
        }
        Actions.emit(users, ClientListenSocketEvents.recieveNowPlayingInfo, sendData)
    }
    @catchError()
    static addChatListMessages(users: (UserModel | string)[], messages: MessageItem[]) {
        Actions.emit(users, ClientListenSocketEvents.addChatListMessages, {
            data: messages
        })
    }

    @catchError()
    static withdrawlChatListMessages(users: (UserModel | string)[], messageIds: string[]) {
        Actions.emit(users, ClientListenSocketEvents.withdrawlChatListMessage, {
            data: messageIds
        })
    }

    @catchError()
    static addPlayListItems(users: (UserModel | string)[], items: PlayListItem[]) {
        Actions.emit(users, ClientListenSocketEvents.addPlayListItems, {
            data: items
        })
    }
    @catchError()
    static deletePlayListItems(users: (UserModel | string)[], ids: string[]) {
        Actions.emit(users, ClientListenSocketEvents.deletePlayListItems, {
            data: ids
        })
    }
    @catchError()
    static movePlayListItem(users: (UserModel | string)[], data: { fromIndex: number; toIndex: number }) {
        Actions.emit(users, ClientListenSocketEvents.movePlayListItem, {
            data
        })
    }

    @catchError()
    static updateUserInfo(users: UserModel[], appendInfo: Object = {}) {
        users.forEach(user => {
            const userInfo = UtilFuncs.extractUserInfo(user)
            Actions.emit([user], ClientListenSocketEvents.updateUserInfo, {
                data: {
                    ...userInfo,
                    ...appendInfo
                }
            })
        })
    }

    @catchError()
    static notification(users: (UserModel | string)[], msg: string, isGlobal = false) {
        Actions.emit(users, ClientListenSocketEvents.notification, {
            data: {
                isGlobal,
                message: msg,
            }
        })
    }

    @catchError()
    static updateRoomBaseInfo(users: (UserModel | string)[], info: {
        id: string;
        name: string;
        creator: string;
        max: number;
        heat: number;
    }) {
        Actions.emit(users, ClientListenSocketEvents.updateRoomInfo, {
            data: info
        })
    }

    @catchError()
    static addRoomAdminActionRecords(users: (UserModel | string)[], actions: AdminAction[]) {
        Actions.emit(users, ClientListenSocketEvents.addAdminActions, {
            data: actions
        })
    }

    @catchError()
    static deleteRoomAdminActionRecords(users: (UserModel | string)[], ids: string[]) {
        Actions.emit(users, ClientListenSocketEvents.deleteAdminActions, {
            data: ids
        })
    }

    @catchError()
    static updateOnlineUsersInfo(users: (UserModel | string)[], updatedUsers: (UserRoomRecord & { isOffline?: boolean })[]) {
        Actions.emit(users, ClientListenSocketEvents.updateOnlineUsers, {
            data: updatedUsers
        })
    }

    @catchError()
    static updateRoomCutMusicVoteInfo(room: RoomModel, users: (UserModel | string)[]) {
        const { vote, heat, nowPlayingInfo } = room
        let baseData = null, votedUserIdSet = new Set()
        if (vote) {
            const { id: musicId, name: musicName } = nowPlayingInfo
            const { disagreeUids, agreeUids, id } = vote
            baseData = {
                id,
                musicId,
                musicName,
                agreeCount: agreeUids.length,
                disagreeCount: disagreeUids.length,
                onlineTotalCount: heat,
            }
            votedUserIdSet = new Set(disagreeUids.concat(agreeUids))
        }
        Actions.usersToSocketIds(users).map((socketId, index) => {
            const socket = UtilFuncs.SocketIdToSocketObjMap.get(socketId)
            const userItem = users[index]
            const userId = typeof userItem === 'object' ? userItem.id : userItem
            const dataObj = baseData ? {
                ...baseData,
                voted: votedUserIdSet.has(userId)
            } : null
            socket && socket.emit(ClientListenSocketEvents.updateRoomCutMusicVoteInfo, {
                data: dataObj
            })
        })
    }

    @catchError()
    static updateSocketStatus(socketIds: string[], status: ScoketStatus) {
        socketIds.forEach(id => {
            const socket = UtilFuncs.SocketIdToSocketObjMap.get(id)
            socket && socket.emit(ClientListenSocketEvents.updateSocketStatus, {
                data: status
            })
        })
    }

    @catchError()
    static closeSocketsConnect(socketIds: string[]) {
        socketIds.map(id => {
            const socket = UtilFuncs.SocketIdToSocketObjMap.get(id)
            socket && socket.disconnect()
        })
    }

    @catchError()
    static closeUsersScoket(users: (UserModel | string)[]) {
        const socketIds = Actions.usersToSocketIds(users)
        socketIds.map(id => {
            const socket = UtilFuncs.SocketIdToSocketObjMap.get(id)
            socket && socket.disconnect()
        })
    }
}

class Handler {
    @catchError()
    static async connected(socket: socketIo.Socket) {
        console.log('inner connected')
        if (!socket.session.isAuthenticated) {
            throw new Error('未通过认证')
        }
        const { user, user: { id: userId }, ip } = socket.session
        const prevUserSocketId = UserToSocketIdMap[userId]

        // 记录 user -> socketId 映射
        UserToSocketIdMap[userId] = socket.id
        // 记录 socketId -> socket object 映射
        UtilFuncs.SocketIdToSocketObjMap.set(socket.id, socket)
        // 记录用户ip地址
        UtilFuncs.addUserIdToIp(ip, userId)

        if (prevUserSocketId) {
            Actions.updateSocketStatus([prevUserSocketId], ScoketStatus.closed)
            Actions.closeSocketsConnect([prevUserSocketId])
        }

        // 下发 用户基本信息
        Actions.updateUserInfo([user])
        // 判断用户是否被全局屏蔽block
        const hallRoom = await Room.findOne(hallRoomId)
        if (UtilFuncs.isUserBlocked(hallRoom, user)) {
            Actions.updateSocketStatus([socket.id], ScoketStatus.globalBlocked)
            return Actions.closeUsersScoket([userId])
        }
        let isUserInfoChanged = false
        // 断线恢复重连
        if (!isSuperAdmin(user)) {
            if (!!user.createdRoom) {
                const room = await Room.findOne(user.createdRoom)
                if (room) {
                    room.join(user)
                    isUserInfoChanged = true
                    await DestroyRoom.cancelDestroy(room)
                } else {
                    user.createdRoom = null
                    await user.save()
                }
            }
            if (!user.append.nowRoomId && !!user.managedRoom) {
                isUserInfoChanged = true
                const room = await Room.findOne(user.managedRoom)
                if (!room || !room.isJoinAble(user)) {
                    user.managedRoom = null
                    await user.save
                } else {
                    room.join(user)
                    room.awardAdmin(user)
                }
            }
        }
        if (isUserInfoChanged) {
            Actions.updateUserInfo([user])
        }
        RoomIpActionDataRecord.userConnected(socket.session.user)
        Actions.updateSocketStatus([socket.id], ScoketStatus.connected)
    }

    @catchError()
    static async disConnect(socket: socketIo.Socket, reason: string) {
        const { user: reqUser } = socket.session
        // 删除 socketId -> socket object 映射 防止内存泄露
        UtilFuncs.SocketIdToSocketObjMap.delete(socket.id)
        const nowUserSocketId = UserToSocketIdMap[reqUser.id]
        if (nowUserSocketId !== socket.id) {
            return
        }
        // 用户当前的socket连接要断开
        UserToSocketIdMap[reqUser.id] = null
        // 删除  ip 与 用户 的映射记录
        UtilFuncs.deleteUserIdOfIp(reqUser.ip, reqUser.id)
        const userRoomInfo = reqUser.append
        if (!userRoomInfo || !userRoomInfo.nowRoomId) {
            return
        }
        const room = await Room.findOne(userRoomInfo.nowRoomId)
        if (userRoomInfo.type === UserRoomRecordTypes.creator) {
            // 定时任务: 如果房间创建者没有重新上线, 五分钟后销毁房间
            await DestroyRoom.destroy(room)
        } else {
            await UtilFuncs.quitRoom(room, reqUser)
        }

    }

    @ListenSocket.register(ServerListenSocketEvents.joinRoom)
    @UtilFuncs.socketApiCatchError()
    static async handleJoinRoom(socket: socketIo.Socket, msg: { token: string, password?: string }, ackFunc?: Function) {
        const reqUser = socket.session.user
        const { token, password } = msg
        const room = await Room.findRoomByToken(token)

        if (!room) { // 房间不存在
            Actions.updateSocketStatus([socket.id], ScoketStatus.invalid)
            return
        }
        // 被该房间所屏蔽（block）
        if (UtilFuncs.isUserBlocked(room, reqUser)) {
            Actions.updateSocketStatus([socket.id], ScoketStatus.roomBlocked)
            return
        }
        if (!room.isJoinAble(reqUser)) {
            throw new Error('房间无法加入')
        }
        if (!UtilFuncs.isRoomAdmin(room, reqUser) && !room.isPublic) {
            const isValid = room.validatePassword(password)
            if (!isValid) {
                ackFunc && ackFunc({
                    success: false,
                    needPassword: true,
                })
                return
            }
        }
        const userRoomInfo = reqUser.append
        if (userRoomInfo.nowRoomId) {
            if (userRoomInfo.nowRoomId === room.id) {
                return ackFunc && ackFunc({
                    success: true
                })
            } else {
                const oldRoom = await Room.findOne(userRoomInfo.nowRoomId)
                await UtilFuncs.quitRoom(oldRoom, reqUser)
            }
        }
        room.join(reqUser)
        Actions.updateUserInfo([reqUser])
        Actions.updateRoomBaseInfo([reqUser], UtilFuncs.getRoomBaseInfo(room))
        const userSocketId = UtilFuncs.getUserNowSocketId(reqUser.id)
        Actions.updateSocketStatus([userSocketId], ScoketStatus.connected)
        ackFunc && ackFunc({
            success: true
        })
    }

    @ListenSocket.register(ServerListenSocketEvents.getRoomData)
    @UtilFuncs.socketApiCatchError()
    static async loadRoomData(socket: SocketIO.Socket, msg: { roomId: string }, ackFunc?: Function) {
        const { roomId } = msg
        const reqUser = socket.session.user
        if (reqUser.append.nowRoomId !== roomId) {
            throw new ResponseError('越权访问', true)
        }
        const room = await Room.findOne(roomId)
        Actions.sendNowRoomPlayingInfo(room, [reqUser])
        Actions.updateRoomBaseInfo([reqUser], UtilFuncs.getRoomBaseInfo(room))
        Actions.addChatListMessages([reqUser], room.messageHistory)
        Actions.addPlayListItems([reqUser], room.playList)
        Actions.updateRoomCutMusicVoteInfo(room, [reqUser])
        if (UtilFuncs.isRoomAdmin(room, reqUser)) {
            Actions.addRoomAdminActionRecords([reqUser], room.adminActions)
        }
        ackFunc && ackFunc({
            success: true
        })
    }

    @ListenSocket.register(ServerListenSocketEvents.createRoom)
    @UtilFuncs.socketApiCatchError()
    static async createRoom(socket: SocketIO.Socket, msg: {
        name: string;
        isPrivate: boolean;
        maxMemberCount: number;
    }, ackFunc?: Function) {
        if (settings.notAllowCreateRoom) {
            throw new ResponseError('不支持多房间')
        }
        const { name, isPrivate, maxMemberCount } = msg
        if (isPrivate && maxMemberCount < 2) {
            throw new ResponseError('房间人数不能小于2')
        }
        const findRoom = await Room.findByIndex('name', name)
        if (findRoom) {
            throw new ResponseError('房间名已存在')
        }
        const reqUser = socket.session.user
        if (!isSuperAdmin(reqUser) && !!reqUser.createdRoom) {
            throw new ResponseError('不能重复创建房间')
        }
        const isPersonalRoom = !isSuperAdmin(reqUser)
        const room = new Room({
            name,
            type: isPersonalRoom ? RoomTypes.personal : RoomTypes.system,
            max: maxMemberCount || -1,
            isPublic: !isPrivate,
            creator: isPersonalRoom ? reqUser.id : null,
        })
        await room.save()
        if (reqUser.append.nowRoomId) {
            const oldRoom = await Room.findOne(reqUser.append.nowRoomId)
            await UtilFuncs.quitRoom(oldRoom, reqUser)
        }
        room.join(reqUser)
        if (isPersonalRoom) {
            reqUser.createdRoom = room.id
            await reqUser.save()
        }
        Actions.updateUserInfo([reqUser])
        ackFunc && ackFunc({
            success: true,
            roomId: room.id,
            roomToken: room.token,
            password: room.getRoomPassword(),
        })
        // 开启房间定时循环任务
        await UtilFuncs.startRoomRoutineTasks(room)
    }

    @ListenSocket.register(ServerListenSocketEvents.manageRoomAdmin)
    @UtilFuncs.socketApiCatchError()
    static async manageRoomAdmin(socket: SocketIO.Socket, msg: {
        roomId: string;
        isAward: boolean;
        userId: string;
    }, ackFunc?: Function) {
        const { roomId, userId, isAward = true } = msg
        const reqUser = socket.session.user
        const room = await Room.findOne(roomId)
        const isAccessableAdmin = isSuperAdmin(reqUser) || reqUser.id === room.id
        if (!isAccessableAdmin) {
            throw new ResponseError('越权操作')
        }
        const aimUser = await User.findOne(userId)
        if (!UtilFuncs.isInRoom(room, aimUser)) {
            throw new ResponseError('该用户不在房间内')
        }
        if (!UtilFuncs.isManageableUser(room, reqUser, aimUser)) {
            throw new ResponseError('越权操作')
        }
        const recordType = isAward ? UserRoomRecordTypes.normalAdmin : UserRoomRecordTypes.others
        if (aimUser.append.type === recordType) {
            throw new ResponseError('请不要重复设置')
        }
        if (isAward) {
            room.awardAdmin(aimUser)
            aimUser.managedRoom = room.id
            await aimUser.save()
        } else {
            room.removeAdmin(aimUser)
            aimUser.managedRoom = null
            await aimUser.save()
        }
        const adminAction: AdminAction = {
            id: Date.now().toString(),
            type: isAward ? AdminActionTypes.awardAdmin : AdminActionTypes.removeAdmin,
            operator: reqUser.id,
            operatorName: reqUser.name || reqUser.ip,
            operatorUserRoomType: reqUser.append.type,
            room: roomId,
            time: Date.now(),
            detail: {
                userId: aimUser.id,
                userName: aimUser.name,
            }
        }
        room.adminActions.unshift(adminAction)
        await room.save()
        Actions.updateUserInfo([aimUser])
        Actions.addRoomAdminActionRecords(room.admins, [adminAction])
        ackFunc && ackFunc({
            success: true,
            admin: aimUser.append,
        })
    }

    @ListenSocket.register(ServerListenSocketEvents.destroyRoom)
    @UtilFuncs.socketApiCatchError()
    static async destroyRoom(socket: SocketIO.Socket, msg: { roomId: string }, ackFunc?: Function) {
        const { roomId } = msg
        const reqUser = socket.session.user
        const room = await Room.findOne(roomId)
        if (!(isSuperAdmin(reqUser) || room.creator === reqUser.id)) {
            throw new ResponseError('越权操作', true)
        }
        await UtilFuncs.destroyRoom(room)
        ackFunc && ackFunc({
            success: true
        })
    }

    @ListenSocket.register(ServerListenSocketEvents.quitRoom)
    @UtilFuncs.socketApiCatchError()
    static async quitRoom(socket: SocketIO.Socket, msg: { roomId: string }, ackFunc?: Function) {
        const { roomId } = msg
        const reqUser = socket.session.user
        if (reqUser.append.nowRoomId !== roomId) {
            throw new ResponseError('越权操作', true)
        }
        const room = await Room.findOne(roomId)
        if (reqUser.id === room.creator) {
            throw new ResponseError('创建者请先销毁房间', true)
        }
        await UtilFuncs.quitRoom(room, reqUser)
        Actions.updateRoomBaseInfo([reqUser], null)
        Actions.updateUserInfo([reqUser])
        ackFunc && ackFunc({
            success: true
        })
    }

    @ListenSocket.register(ServerListenSocketEvents.switchPlayMode)
    @UtilFuncs.socketApiCatchError()
    static async switchRoomPlayMode(socket: SocketIO.Socket, msg: { roomId: string, mode: RoomMusicPlayMode, autoPlayType: string }, ackFunc?: Function) {
        const { roomId, mode, autoPlayType } = msg
        const reqUser = socket.session.user
        const room = await Room.findOne(roomId)
        if (!UtilFuncs.isRoomAdmin(room, reqUser)) {
            throw new ResponseError('越权操作')
        }
        if (!Object.values(RoomMusicPlayMode).includes(mode)) {
            throw new ResponseError('无效参数')
        }
        let needStartPlaying = false, oldPlayList = room.playList
        const playModeInfo = UtilFuncs.getRoomPlayInfoFromMsg(msg)
        if (isDeepEqual(room.playModeInfo, playModeInfo)) {
            throw new ResponseError('请不要重复设置')
        }
        if (mode === RoomMusicPlayMode.auto) {
            const playLists = await NetEaseApi.getHighQualityMusicList(autoPlayType)
            const selected = getArrRandomItem(playLists)
            const playListInfo = await NetEaseApi.getPlayListInfo(selected.id)
            room.nowPlayingInfo = null
            room.playList = playListInfo.musicList.filter(item => {
                return item.free
            })
            needStartPlaying = true
        } else if (mode == RoomMusicPlayMode.demand) {
            room.nowPlayingInfo = null
            room.playList = []
        } else {
            return
        }
        room.playModeInfo = playModeInfo
        room.vote = null
        await room.save()
        Actions.updateRoomBaseInfo(room.joiners, UtilFuncs.getRoomBaseInfo(room))
        Actions.deletePlayListItems(room.joiners, oldPlayList.map(i => i.id))
        Actions.sendNowRoomPlayingInfo(room, room.joiners)
        Actions.updateRoomCutMusicVoteInfo(room, room.joiners)
        ackFunc && ackFunc({
            success: true
        })
        if (needStartPlaying && room.playList.length !== 0) {
            const playItem = room.playList[0]
            await ManageRoomPlaying.initPlaying(room, playItem)
        }
    }

    @ListenSocket.register(ServerListenSocketEvents.pausePlaying)
    @UtilFuncs.socketApiCatchError()
    static async pausePlaying(socket: SocketIO.Socket, msg: { roomId: string, musicId: string }, ackFunc?: Function) {
        const { roomId, musicId } = msg
        if (!roomId || !musicId) {
            throw new ResponseError('无效参数', true)
        }
        const reqUser = socket.session.user
        const room = await Room.findOne(roomId)
        if (!UtilFuncs.isRoomAdmin(room, reqUser)) {
            throw new ResponseError('越权操作', true)
        }
        if (room.nowPlayingInfo.id !== musicId) {
            throw new ResponseError('音乐id错误', true)
        }
        await ManageRoomPlaying.pausePlaying(room)
        ackFunc && ackFunc({
            success: true
        })
    }

    @ListenSocket.register(ServerListenSocketEvents.startPlaying)
    @UtilFuncs.socketApiCatchError()
    static async startPlaying(socket: SocketIO.Socket, msg: { roomId: string, musicId: string }, ackFunc?: Function) {
        const { roomId, musicId } = msg
        if (!roomId || !musicId) {
            throw new ResponseError('无效参数', true)
        }
        const reqUser = socket.session.user
        const room = await Room.findOne(roomId)
        if (!UtilFuncs.isRoomAdmin(room, reqUser)) {
            throw new ResponseError('越权操作', true)
        }
        if (room.nowPlayingInfo.id !== musicId) {
            throw new ResponseError('音乐id错误', true)
        }
        await ManageRoomPlaying.startPlaying(room)
        ackFunc && ackFunc({
            success: true
        })
    }

    @ListenSocket.register(ServerListenSocketEvents.cutMusic)
    @UtilFuncs.socketApiCatchError()
    static async cutMusic(socket: SocketIO.Socket, msg: { roomId: string }, ackFunc?: Function) {
        const { roomId } = msg
        if (!roomId) {
            throw new ResponseError('无效参数', true)
        }
        const reqUser = socket.session.user
        const room = await Room.findOne(roomId)
        if (!UtilFuncs.isRoomAdmin(room, reqUser)) {
            throw new ResponseError('越权操作', true)
        }
        const isAutoPlayMode = room.playMode === RoomMusicPlayMode.auto;
        const lengthRequired = isAutoPlayMode ? 1 : 2  
        if (room.playList.length < lengthRequired) {
            throw new ResponseError('没有下一首', true)
        }
        await ManageRoomPlaying.switchRoomPlaying(room)
        ackFunc && ackFunc({
            success: true
        })
    }

    /**
     * 切歌api  超级管理员可以发起投票，但是不能进行投票，其他普通用户可以发起和参与投票
     * @param socket 
     * @param msg 
     */
    @ListenSocket.register(ServerListenSocketEvents.voteToCutMusic)
    @UtilFuncs.socketApiCatchError()
    static async voteToCutMusic(socket: SocketIO.Socket, msg: {
        roomId: string,
        musicId: string,
        agree: boolean,
    }, ackFunc: Function) {
        const { roomId, agree } = msg
        if (!roomId) {
            throw new ResponseError('无效参数')
        }
        const reqUser = socket.session.user
        if (reqUser.append.nowRoomId !== roomId) {
            throw new ResponseError('越权操作')
        }
        const room = await Room.findOne(roomId)
        if (
            ManageRoomPlaying.isRoomPlaying(room) &&
            (room.nowPlayingInfo.endAt - Date.now() / 1000 < 10)) {
            throw new ResponseError('播放即将结束，无法投票')
        }
        if (room.playList.length <= 1) {
            return Actions.notification([reqUser], '没有下一首！')
        }
        let isCut = false, responseStr = '', boradcastStr = ''
        // 新建投票
        if (!room.vote) {
            if (room.heat === 1 && !isSuperAdmin(reqUser)) {
                isCut = true
            } else {
                room.vote = {
                    id: Date.now(),
                    musicId: room.nowPlayingInfo.id,
                    agreeUids: [],
                    disagreeUids: [],
                }
                if (!isSuperAdmin(reqUser)) {
                    room.vote.agreeUids.push(reqUser.id)
                    room.updateProperty('vote')
                }
                await room.save()
                responseStr = '创建切歌投票成功'
            }
        } else {
            // 参与投票
            if (isSuperAdmin(reqUser)) {
                throw new ResponseError('超级管理员不能参与投票')
            }
            const { vote } = room
            if (vote.agreeUids.includes(reqUser.id) || vote.disagreeUids.includes(reqUser.id)) {
                throw new ResponseError('请不要重复投票!')
            }
            agree ? vote.agreeUids.push(reqUser.id) : vote.disagreeUids.push(reqUser.id)
            const roomJoinerSet = new Set(room.joiners)
            vote.agreeUids = vote.agreeUids.filter(id => roomJoinerSet.has(id))
            await room.save()
            const agreeCount = vote.agreeUids.length
            // TODO 优化判定算法
            if (agreeCount / room.heat >= 0.4) {
                isCut = true
            }
            responseStr = '投票成功'
        }

        if (isCut) {
            const isRoomPlaying = ManageRoomPlaying.isRoomPlaying(room)
            if (isRoomPlaying) {
                await ManageRoomPlaying.pausePlaying(room)
            }
            await ManageRoomPlaying.removeNowPlaying(room)

            await UtilFuncs.startPlayFromPlayListInOrder(room)
            boradcastStr = '投票切歌成功'
        } else {
            Actions.updateRoomCutMusicVoteInfo(room, room.joiners)
        }
        responseStr && Actions.notification([reqUser], responseStr)
        boradcastStr && Actions.notification(room.joiners, boradcastStr)
        ackFunc && ackFunc({
            success: true
        })
    }

    @ListenSocket.register(ServerListenSocketEvents.changeProgress, {
        useBlock: {
            getKey: (event, socket, msg, ...args) => {
                const { roomId } = msg
                if (!roomId) {
                    return ''
                }
                return `${event}:${roomId}`
            },
        }
    })
    @UtilFuncs.socketApiCatchError()
    static async changeProgress(socket: SocketIO.Socket, msg: { roomId: string, progress: number, musicId: string }, ackFunc: Function) {
        const { roomId, musicId, progress = 0 } = msg
        const reqUser = socket.session.user
        if (!roomId || !musicId) {
            throw new ResponseError('无效参数', true)
        }
        const room = await Room.findOne(roomId)
        if (!UtilFuncs.isRoomAdmin(room, reqUser)) {
            throw new ResponseError('越权操作', true)
        }
        if (room.nowPlayingInfo.id !== musicId) {
            throw new ResponseError('音乐id错误', true)
        }
        await ManageRoomPlaying.changePlayingProgress(room, progress)
        ackFunc && ackFunc({
            success: true
        })
    }

    @ListenSocket.register(ServerListenSocketEvents.sendMessage, {
        useBlock: {
            wait: true,
            getKey: (event, socket, msg, ...args) => {
                const { roomId } = msg
                if (!roomId) {
                    return ''
                }
                return `${event}:${roomId}`
            },
        }
    })
    @UtilFuncs.socketApiCatchError()
    static async sendMessages(socket: SocketIO.Socket, msg: {
        roomId: string;
        text?: string;
        atSign: MessageItem['content']['atSign'];
        emojiId?: string;
    }, ackFunc?: Function) {
        const { roomId, text, emojiId, atSign } = msg
        const reqUser = socket.session.user
        if (reqUser.append.nowRoomId !== roomId) {
            throw new ResponseError('越权操作')
        }
        if (!text && !emojiId) {
            throw new ResponseError('消息不能为空')
        }
        if (!!text && !await UtilFuncs.validateText(text)) {
            throw new ResponseError('含有违规词')
        }
        // TODO 防注入
        const room = await Room.findOne(roomId)
        const isAdmin = isSuperAdmin(reqUser) || reqUser.id === room.creator
        let messageType, messageContent: Partial<MessageItem['content']> = {}
        if (text || (atSign && !!atSign.length)) {
            messageType = isAdmin ? MessageTypes.advanced : MessageTypes.normal
            messageContent = {
                text: text || '',
            }
            if (atSign) {
                messageContent.atSign = atSign
            }
        }
        if (emojiId) {
            messageType = MessageTypes.emoji
            const emojiItem = emojiData.find(o => o.id === emojiId)
            if (!emojiItem) {
                throw new ResponseError('invalid emoji id', true)
            }
            messageContent = {
                title: emojiItem.title,
                img: emojiItem.src
            }
        }
        const message: MessageItem = {
            id: Date.now().toString(),
            fromId: reqUser.id,
            from: reqUser.name || hideIp(reqUser.ip) || `匿名用户${reqUser.id.slice(0, 5)}`,
            tag: isAdmin ? '管理员' : '',
            time: new Date().toString(),
            content: messageContent,
            type: messageType
        }
        room.messageHistory.push(message)
        if (room.messageHistory.length >= (settings.maxChatListLength + 10)) {
            room.messageHistory = room.messageHistory.slice(-settings.maxChatListLength)
        }
        await room.save()
        Actions.addChatListMessages(room.joiners, [message])
        if (room.isPublic && !!message.content.text) {
            RoomIpActionDataRecord.sendTextMessage(reqUser, message)
        }
        ackFunc && ackFunc({
            success: true
        })
    }

    @ListenSocket.register(ServerListenSocketEvents.blockUser)
    @UtilFuncs.socketApiCatchError()
    static async blockUser(socket: SocketIO.Socket, msg: {
        roomId: string;
        userId: string;
    }, ackFunc?: Function) {
        const { roomId, userId } = msg
        const reqUser = socket.session.user
        const room = await Room.findOne(roomId)
        if (!UtilFuncs.isRoomAdmin(room, reqUser)) {
            throw new ResponseError('越权操作', true)
        }
        const blockedUser = await User.findOne(userId)
        if (!UtilFuncs.isManageableUser(room, reqUser, blockedUser)) {
            throw new ResponseError('越权操作')
        }
        if (room.blockUsers.includes(blockedUser.id)) {
            throw new ResponseError('该用户已被屏蔽!', true)
        }
        room.blockUsers = safePushArrItem(room.blockUsers, blockedUser)
        const newAction = {
            id: Date.now().toString(),
            type: AdminActionTypes.blockUser,
            isSuperAdmin: isSuperAdmin(reqUser),
            operator: reqUser.id,
            operatorName: reqUser.name || reqUser.id,
            operatorUserRoomType: reqUser.append.type,
            room: roomId,
            time: Date.now(),
            detail: {
                userId,
                userName: blockedUser.name || hideIp(blockedUser.ip),
            }
        }
        room.adminActions.unshift(newAction)
        await room.save()
        Actions.addRoomAdminActionRecords(room.admins, [newAction])
        if (room.isHallRoom || room.joiners.includes(userId)) {
            // 断开被屏蔽者的socket连接 (如果该用户在线)
            const userSocketId = UtilFuncs.getUserNowSocketId(userId)
            Actions.updateSocketStatus([userSocketId], room.isHallRoom ? ScoketStatus.globalBlocked : ScoketStatus.roomBlocked)
            Actions.closeUsersScoket([blockedUser])
        }
        ackFunc && ackFunc({
            success: true,
            blockedUser: blockedUser.append
        })
    }

    @ListenSocket.register(ServerListenSocketEvents.blockUserIp)
    @UtilFuncs.socketApiCatchError()
    static async blockIp(socket: SocketIO.Socket, msg: {
        roomId: string;
        userId: string; // 根据userid查到ip
    }, ackFunc?: Function) {
        const { roomId, userId } = msg
        const reqUser = socket.session.user
        const room = await Room.findOne(roomId)
        if (!UtilFuncs.isRoomAdmin(room, reqUser)) {
            throw new ResponseError('越权操作', true)
        }
        const aimUser = await User.findOne(userId)
        const aimIp = aimUser.ip
        if (room.blockIps.includes(aimIp)) {
            throw new ResponseError('该ip已被屏蔽', true)
        }

        room.blockIps = safePushArrItem(room.blockIps, aimIp)
        const newAction = {
            id: Date.now().toString(),
            type: AdminActionTypes.blockIp,
            isSuperAdmin: isSuperAdmin(reqUser),
            operator: reqUser.id,
            operatorName: reqUser.name || reqUser.ip,
            operatorUserRoomType: reqUser.append.type,
            room: roomId,
            time: Date.now(),
            detail: {
                ip: aimIp
            }
        }
        room.adminActions.unshift(newAction)
        await room.save()
        let blockedUserIds = UtilFuncs.getIpOnlineUserIds(aimIp)
        if (!room.isHallRoom) {
            const set = new Set(room.joiners)
            blockedUserIds = blockedUserIds.filter(id => set.has(id))
        }
        let blockUsers = await User.find(blockedUserIds)
        blockUsers = blockUsers.filter(user => !(UtilFuncs.isRoomAdmin(room, user)))
        const userSocketIds = blockUsers.map(user => UtilFuncs.getUserNowSocketId(user.id))
        Actions.updateSocketStatus(userSocketIds, room.isHallRoom ? ScoketStatus.globalBlocked : ScoketStatus.roomBlocked)
        Actions.closeUsersScoket(blockedUserIds)
        Actions.addRoomAdminActionRecords(room.admins, [newAction])
        ackFunc && ackFunc({
            success: true
        })
    }

    @ListenSocket.register(ServerListenSocketEvents.banUserComment)
    @UtilFuncs.socketApiCatchError()
    static async banUserComment(socket: SocketIO.Socket, msg: {
        roomId: string;
        userId: string;
    }, ackFunc?: Function) {
        const { roomId, userId } = msg
        const reqUser = socket.session.user
        const room = await Room.findOne(roomId)
        if (!UtilFuncs.isRoomAdmin(room, reqUser)) {
            throw new ResponseError('越权操作', true)
        }
        const aimUser = await User.findOne(userId)
        if (!UtilFuncs.isManageableUser(room, reqUser, aimUser)) {
            throw new Error('越权操作')
        }
        if (room.banUsers.includes(aimUser.id)) {
            throw new ResponseError('该用户已被禁言!', true)
        }
        room.banUsers = safePushArrItem(room.banUsers, aimUser.id)
        const newAction = {
            id: Date.now().toString(),
            type: AdminActionTypes.banUserComment,
            isSuperAdmin: isSuperAdmin(reqUser),
            operator: reqUser.id,
            operatorName: reqUser.name || reqUser.ip,
            operatorUserRoomType: reqUser.append.type,
            room: roomId,
            time: Date.now(),
            detail: {
                userId,
                userName: aimUser.name || hideIp(aimUser.ip),
            }
        }
        room.adminActions.unshift(newAction)
        await room.save()
        aimUser.allowComment = false;
        await aimUser.save()
        UtilFuncs.updateUserRoomRecordObj(aimUser, {
            allowComment: aimUser.allowComment
        })
        Actions.updateUserInfo([aimUser])
        Actions.addRoomAdminActionRecords(room.admins, [newAction])
        ackFunc && ackFunc({
            success: true,
            banUser: aimUser.append,
        })
    }


    @ListenSocket.register(ServerListenSocketEvents.withdrawlMessage)
    @UtilFuncs.socketApiCatchError()
    static async withdrawMessage(socket: SocketIO.Socket, msg: {
        roomId: string;
        messageId: string;
        content: string;
        fromId: string;
    }, ackFunc?: Function) {
        const { roomId, messageId, content, fromId } = msg
        const reqUser = socket.session.user
        const room = await Room.findOne(roomId)
        if (!UtilFuncs.isRoomAdmin(room, reqUser)) {
            throw new ResponseError('越权操作', true)
        }
        if (!messageId) {
            throw new ResponseError('操作目标不能为空', true)
        }
        const fromUser = await User.findOne(fromId)
        if (fromUser.id !== reqUser.id && !UtilFuncs.isManageableUser(room, reqUser, fromUser)) {
            throw new Error('越权操作')
        }
        const newAction = {
            id: Date.now().toString(),
            type: AdminActionTypes.withdrwalMessage,
            isSuperAdmin: isSuperAdmin(reqUser),
            operator: reqUser.id,
            operatorName: reqUser.name || reqUser.ip,
            operatorUserRoomType: reqUser.append.type,
            room: roomId,
            time: Date.now(),
            detail: {
                userId: fromId,
                userName: fromUser.name || fromUser.ip,
                message: content,
                messageId,
            }
        }
        room.adminActions.unshift(newAction)
        room.messageHistory = room.messageHistory.filter(item => item.id !== messageId)
        await room.save()
        Actions.addRoomAdminActionRecords(room.admins, [newAction])
        Actions.withdrawlChatListMessages(room.joiners, [messageId])
        ackFunc && ackFunc({
            success: true
        })
    }

    @ListenSocket.register(ServerListenSocketEvents.revokeAction)
    @UtilFuncs.socketApiCatchError()
    static async revokeAdminAction(socket: SocketIO.Socket, msg: { roomId: string, revokeActionId: string }, ackFunc?: Function) {
        const { roomId, revokeActionId } = msg
        const reqUser = socket.session.user
        const room = await Room.findOne(roomId)
        if (!UtilFuncs.isRoomAdmin(room, reqUser)) {
            throw new ResponseError('越权操作', true)
        }
        const action = room.adminActions.find(item => item.id === revokeActionId)
        if (!action) {
            throw new ResponseError('该操作不存在', true)
        }
        if ([AdminActionTypes.withdrwalMessage, AdminActionTypes.awardAdmin, AdminActionTypes.removeAdmin].includes(action.type)) {
            throw new ResponseError('该类型操作不支持撤销')
        }
        const actionAimUserId = action.detail.userId
        if (actionAimUserId) {
            const aimUser = await User.findOne(actionAimUserId)
            if (!UtilFuncs.isManageableUser(room, reqUser, aimUser)) {
                throw new Error('越权操作')
            }
        }
        if (action.type === AdminActionTypes.blockUser) {
            room.blockUsers = safeRemoveArrItem(room.blockUsers, action.detail.userId)
        }
        if (action.type === AdminActionTypes.blockIp) {
            room.blockIps = safeRemoveArrItem(room.blockIps, action.detail.ip)
        }
        if (action.type === AdminActionTypes.banUserComment) {
            room.banUsers = safeRemoveArrItem(room.banUsers, action.detail.userId)
            const aimUser = await User.findOne(action.detail.userId)
            const isUserInRoom = room.joiners.includes(aimUser.id)
            if (isUserInRoom) {
                aimUser.allowComment = true
                await aimUser.save()
                UtilFuncs.updateUserRoomRecordObj(aimUser, {
                    allowComment: true
                })
                Actions.updateUserInfo([aimUser])
            }
        }
        room.adminActions = safeRemoveArrItem(room.adminActions, action)
        await room.save()
        Actions.deleteRoomAdminActionRecords(room.admins, [action.id])
        ackFunc && ackFunc({
            success: true
        })
    }

    @ListenSocket.register(ServerListenSocketEvents.getOnlineUserList)
    @UtilFuncs.socketApiCatchError()
    static async getRoomOnlineUsers(socket: SocketIO.Socket, msg: { roomId: string, lastId: string, searchStr: string }, ackFunc?: Function) {
        const { roomId, lastId, searchStr = '' } = msg
        if (!roomId) {
            throw new ResponseError('无效参数')
        }
        const room = await Room.findOne(roomId)
        if (!UtilFuncs.isRoomAdmin(room, socket.session.user)) {
            throw new ResponseError('越权操作', true)
        }
        let hasMore = true, searchTree = null, admins: UserRoomRecord[] = [], others: UserRoomRecord[] = [], list: UserRoomRecord[] = []
        if (!!searchStr) {
            const roomUserRecords = room.getRoomUserRecords()
            searchTree = {
                userName: true
            }
            UtilFuncs.searchValueFromObj(roomUserRecords, searchTree, searchStr, (obj, isMatched) => {
                if (isMatched) {
                    list.push(obj)
                }
            })
            hasMore = false
        } else {
            let ids = []
            if (!lastId) {
                ids = [...room.admins]
            }
            const findIndex = !!lastId ? room.normalJoiners.findIndex(id => id === lastId) : -1
            const limit = 10
            const startIndex = findIndex + 1
            const endIndex = startIndex + limit
            ids = ids.concat(room.normalJoiners.slice(startIndex, endIndex))
            list = User.getUserRoomRecords(ids)
            hasMore = startIndex < room.normalJoiners.length - 1
        }
        ackFunc && ackFunc({
            success: true,
            list,
            hasMore,
            searchTree,
            searchStr,
        })
    }


    @ListenSocket.register(ServerListenSocketEvents.blockPlayListItems)
    @UtilFuncs.socketApiCatchError()
    static async blockPlayListItems(socket: SocketIO.Socket, msg: { ids: string[] }, ackFunc?: Function) {
        const { ids = [] } = msg
        if (!ids.length) {
            return
        }
        const reqUser = socket.session.user
        reqUser.blockPlayItems = safePushArrItem(reqUser.blockPlayItems, ids)
        await reqUser.save()
        Actions.updateUserInfo([reqUser])
        ackFunc && ackFunc({
            success: true
        })
    }

    @ListenSocket.register(ServerListenSocketEvents.unblockPlayListItems)
    @UtilFuncs.socketApiCatchError()
    static async unblockPlayListItems(socket: SocketIO.Socket, msg: { ids: string[] }, ackFunc?: Function) {
        const { ids = [] } = msg
        if (!ids.length) {
            return
        }
        const reqUser = socket.session.user
        reqUser.blockPlayItems = safeRemoveArrItem(reqUser.blockPlayItems, ids)
        await reqUser.save()
        Actions.updateUserInfo([reqUser])
        ackFunc && ackFunc({
            success: true
        })
    }

    @ListenSocket.register(ServerListenSocketEvents.addPlayListItems, {
        useBlock: {
            wait: true,
            getKey: (event, socket, msg, ...args) => {
                const { roomId } = msg
                if (!roomId) {
                    return ''
                }
                return `${event}:${roomId}`
            },
        }
    })
    @UtilFuncs.socketApiCatchError()
    static async addPlayListItems(socket: SocketIO.Socket, msg: { ids: string[], roomId: string }, ackFunc?: Function) {
        const { ids = [], roomId } = msg
        if (!ids.length) {
            return
        }
        const musicIds = Array.from(new Set(ids))
        const reqUser = socket.session.user
        const room = await Room.findOne(roomId)
        UtilFuncs.checkIsAutoPlayMode(room, '添加音乐')
        const isSuper = isSuperAdmin(reqUser)
        if (!isSuper && reqUser.append.nowRoomId !== roomId) {
            throw new ResponseError('越权操作', true)
        }
        const oldMusicIdSet = new Set(room.playList.map(i => i.id))
        const existed: string[] = [], newMusics = [], excluded = []
        for (let musicId of musicIds) {
            if (oldMusicIdSet.has(musicId)) {
                existed.push(musicId)
                continue
            }
            const [info] = await NetEaseApi.getMusicBaseInfo([musicId])
            const { id, name, artist, album, duration } = info
            if (!info.free || BlockMusicList.includes(name) || duration > settings.musicDurationLimit) {
                excluded.push(name)
                continue
            }
            newMusics.push({
                id,
                name,
                artist,
                album,
                duration,
                from: reqUser.name || hideIp(reqUser.ip),
                fromId: reqUser.id,
            })
        }
        const autoStartPlaying = room.playList.length === 0
        room.playList = safePushArrItem(room.playList, newMusics)
        await room.save()
        if (autoStartPlaying && !!room.playList.length) {
            await UtilFuncs.startPlayFromPlayListInOrder(room)
        }
        Actions.addPlayListItems(room.joiners, newMusics)

        const messages: string[] = []
        existed.length && messages.push(`${existed.length}首已在列表中`)
        excluded.length && excluded.forEach(name => messages.push(`《${name}》暂不支持播放`))
        newMusics.length && messages.push(`${newMusics.length}首添加成功!`)

        messages.forEach(msg => {
            Actions.notification([reqUser], msg, true)
        })
        RoomIpActionDataRecord.playMusics(reqUser, newMusics)
        ackFunc && ackFunc({
            success: true
        })
    }

    @ListenSocket.register(ServerListenSocketEvents.deletePlayListItems, {
        useBlock: {
            getKey: (event, socket, msg, ...args) => {
                const { roomId } = msg
                if (!roomId) {
                    return ''
                }
                return `${event}:${roomId}`
            },
        }
    })
    @UtilFuncs.socketApiCatchError()
    static async deletePlayListItems(socket: SocketIO.Socket, msg: { ids: string[], roomId: string }, ackFunc?: Function) {
        const { ids = [], roomId } = msg
        if (!ids.length) {
            return
        }
        const toDelIds = new Set(ids)
        const reqUser = socket.session.user
        const room = await Room.findOne(roomId)
        UtilFuncs.checkIsAutoPlayMode(room, '删除音乐')
        if (!UtilFuncs.isRoomAdmin(room, reqUser)) {
            throw new ResponseError('越权操作', true)
        }

        let nowPlayingId, isRoomPlaying = false
        if (room.nowPlayingInfo) {
            nowPlayingId = room.nowPlayingInfo.id
            isRoomPlaying = ManageRoomPlaying.isRoomPlaying(room)
        }

        room.playList = room.playList.filter(item => !toDelIds.has(item.id))
        await room.save()
        if (toDelIds.has(nowPlayingId)) {
            await ManageRoomPlaying.removeNowPlaying(room)
        }
        Actions.notification([reqUser], '删除成功')
        Actions.deletePlayListItems(room.joiners, Array.from(toDelIds))

        if (!room.nowPlayingInfo && room.playList.length) {
            await UtilFuncs.startPlayFromPlayListInOrder(room, isRoomPlaying)
        }
        ackFunc && ackFunc({
            success: true
        })

    }

    @ListenSocket.register(ServerListenSocketEvents.movePlayListItem, {
        useBlock: {
            getKey: (event, socket, msg, ...args) => {
                const { roomId } = msg
                if (!roomId) {
                    return ''
                }
                return `${event}:${roomId}`
            },
        }
    })
    @UtilFuncs.socketApiCatchError()
    static async movePlayListItem(socket: SocketIO.Socket, msg: {
        fromIndex: number;
        toIndex: number;
        roomId: string;
    }, ackFunc?: Function) {
        const { fromIndex, toIndex, roomId } = msg
        if (fromIndex === toIndex) {
            return
        }
        const reqUser = socket.session.user
        const room = await Room.findOne(roomId)
        UtilFuncs.checkIsAutoPlayMode(room, '移动音乐')
        if (!UtilFuncs.isRoomAdmin(room, reqUser)) {
            throw new ResponseError('越权操作', true)
        }
        const fromItem = room.playList[fromIndex]
        const toItem = room.playList[toIndex]
        if (!fromItem || !toItem) {
            throw new ResponseError('invalid index', true)
        }

        room.playList.splice(fromIndex, 1)
        room.playList.splice(toIndex, 0, fromItem)
        await room.save()
        Actions.movePlayListItem(room.joiners, {
            fromIndex,
            toIndex
        })
        Actions.notification([reqUser], '移动成功')

        if (toIndex === 0) {
            const isRoomPlaying = ManageRoomPlaying.isRoomPlaying(room)
            if (isRoomPlaying) {
                await ManageRoomPlaying.pausePlaying(room)
            }
            await ManageRoomPlaying.removeNowPlaying(room)

            await UtilFuncs.startPlayFromPlayListInOrder(room, isRoomPlaying)
        }
        ackFunc && ackFunc({
            success: true
        })
    }

    @ListenSocket.register(ServerListenSocketEvents.getEmojiList)
    @UtilFuncs.socketApiCatchError()
    static async getEmojiList(socket: SocketIO.Socket, msg: { lastId: string, limit?: number }, ackFunc: Function) {
        const { lastId, limit = 10 } = msg
        const queryLimit = limit > 15 ? 15 : limit
        const findIndex = lastId ? (emojiData.findIndex(e => e.id === lastId) + 1) : 0
        const list = emojiData.slice(findIndex, findIndex + queryLimit)
        ackFunc && ackFunc({
            success: true,
            list,
            hasMore: findIndex + queryLimit < emojiData.length
        })
    }


    @ListenSocket.register(ServerListenSocketEvents.searchMedia)
    @UtilFuncs.socketApiCatchError()
    static async searchMedia(socket: SocketIO.Socket, msg: { keywords: string }, ackFunc: Function) {
        const { keywords = '' } = msg
        if (!keywords.trim()) {
            return
        }
        const songs = await NetEaseApi.searchMedia(keywords, MediaTypes.song)
        const albums = await NetEaseApi.searchMedia(keywords, MediaTypes.album)
        const all = [
            {
                type: MediaTypes.song,
                list: songs
            },
            {
                type: MediaTypes.album,
                list: albums
            }
        ]
        ackFunc && ackFunc({
            success: true,
            list: all
        })
    }

    @ListenSocket.register(ServerListenSocketEvents.getMediaDetail)
    @UtilFuncs.socketApiCatchError()
    static async getAlbumInfo(socket: SocketIO.Socket, msg: { id: string }, ackFunc) {
        const { id } = msg
        if (!id) {
            throw new ResponseError('invalid id', true)
        }
        const albumInfo = await NetEaseApi.getAlbumInfo(id)
        const { name, desc, pic, musicList } = albumInfo
        ackFunc && ackFunc({
            success: true,
            detail: {
                name,
                desc,
                pic,
                type: MediaTypes.album,
                list: musicList.map(m => {
                    const { name, id, pic } = m
                    return {
                        title: name,
                        id,
                        pic,
                        type: MediaTypes.song
                    }
                })
            }
        })
    }

    @ListenSocket.register(ServerListenSocketEvents.recommendRoom)
    @UtilFuncs.socketApiCatchError()
    static async loadRoomList(socket: SocketIO.Socket, msg: { lastId: string, excludeId?: string }, ackFunc: Function) {
        const { lastId, excludeId } = msg
        const limit = 10
        const reqUser = socket.session.user
        const isSuper = isSuperAdmin(reqUser)
        const allRoomIds = isSuper ? await Room.findAll(true) : await Room.getPublicRooms(true)
        const findIndex = allRoomIds.indexOf(lastId)
        const offset = findIndex + 1
        let roomIds = []
        if (excludeId) {
            allRoomIds.slice(offset).some(id => {
                if (roomIds.length === limit) {
                    return true
                }
                if (id === excludeId) {
                    return
                }
                roomIds.push(id)
            })
        } else {
            roomIds = allRoomIds.slice(offset, offset + limit)
        }
        const rooms = await Room.find(roomIds)
        ackFunc && ackFunc({
            success: true,
            list: rooms.map(room => {
                const { pic, name: playing } = room.nowPlayingInfo || {}
                const { token, id, name, heat } = room
                return {
                    id,
                    token,
                    heat,
                    title: name,
                    pic,
                    playing,
                }
            }),
            hasMore: offset + limit < allRoomIds.length - 1
        })
    }

    @ListenSocket.register(ServerListenSocketEvents.getRoomAdminActionList)
    @UtilFuncs.socketApiCatchError()
    static async getAdminActions(socket: SocketIO.Socket, msg: {
        lastId: string;
        roomId: string;
        searchStr: string;
    }, ackFunc: Function) {
        const { lastId, roomId, searchStr = '' } = msg
        if (!roomId) {
            throw new ResponseError('无效参数')
        }
        const room = await Room.findOne(roomId)
        if (!UtilFuncs.isRoomAdmin(room, socket.session.user)) {
            throw new ResponseError('越权操作', true)
        }
        let list: AdminAction[] = [], hasMore = true, searchTree = null
        const adminActions = room.adminActions || []
        if (!!searchStr) {
            searchTree = {
                operatorName: true,
                detail: {
                    ip: true,
                    userName: true,
                    message: true,
                }
            }
            UtilFuncs.searchValueFromObj(adminActions, searchTree, searchStr, (obj, isMatched) => {
                if (isMatched) {
                    list.push(obj)
                }
            })
            hasMore = false
        } else {
            const findIndex = !!lastId ? adminActions.findIndex(item => item.id === lastId) : -1
            const limit = 10
            const startIndex = findIndex + 1
            const endIndex = startIndex + limit
            list = adminActions.slice(startIndex, endIndex)
            hasMore = endIndex < adminActions.length
        }
        ackFunc && ackFunc({
            success: true,
            list,
            hasMore,
            searchTree,
            searchStr,
        })
    }

    @ListenSocket.register(ServerListenSocketEvents.getRoomCoordHotData)
    @UtilFuncs.socketApiCatchError()
    static async getRoomCoordHotData(socket: SocketIO.Socket, msg: null, ackFunc: Function) {
        const data = RoomIpActionDataRecord.getRoomCoordData()
        ackFunc && ackFunc({
            success: true,
            data,
        })
    }

    @ListenSocket.register(ServerListenSocketEvents.setNickName)
    @UtilFuncs.socketApiCatchError()
    static async setNickName(socket: SocketIO.Socket, msg: {
        nickName: string
    }, ackFunc: Function) {
        let { nickName } = msg
        nickName = nickName.trim()
        if (!nickName) {
            throw new ResponseError('不能为空')
        }
        if (/.*\[.*\].*/.test(nickName)) {
            throw new ResponseError('不能包含保留字符')
        }
        if (!await UtilFuncs.validateText(nickName)) {
            throw new ResponseError('含有违规词')
        }
        const reqUser = socket.session.user
        const findUser = await User.findByIndex('name', nickName)
        if (findUser && findUser.id !== reqUser.id) {
            throw new ResponseError('该昵称已被占用')
        }
        reqUser.name = nickName
        await reqUser.save()
        UtilFuncs.updateUserRoomRecordObj(reqUser, {
            userName: nickName
        })
        Actions.updateUserInfo([reqUser])
        ackFunc && ackFunc({
            success: true,
        })
    }

    @ListenSocket.register(ServerListenSocketEvents.cutUserStatus)
    @UtilFuncs.socketApiCatchError()
    static async cutUserStatus(socket: SocketIO.Socket, msg: {
        status: UserStatus
    }, ackFunc: Function) {
        const { status } = msg
        const reqUser = socket.session.user
        if (typeof status !== 'number') {
            throw new ResponseError('参数错误')
        }
        if (reqUser.status < UserStatus.superOfNormal) {
            throw new ResponseError('越权操作')
        }
        if (status === reqUser.status) {
            throw new ResponseError('请不要重复设置')
        }
        const sokcetId = UtilFuncs.getUserNowSocketId(reqUser.id)
        Actions.updateSocketStatus([sokcetId], ScoketStatus.closed)
        Actions.closeSocketsConnect([sokcetId])
        reqUser.status = status
        await reqUser.save()
    }
    // express route handler
    @HandleHttpRoute.get(/^\/[^\/]*$/)
    @UtilFuncs.routeHandlerCatchError()
    static async renderIndex(req: Request, res: Response) {
        res.sendFile(path.join(injectedConfigs.staticPath, './index.html'))
    }

    // 前端初始化信息
    @HandleHttpRoute.get('/frontend/init')
    @UtilFuncs.routeHandlerCatchError()
    static async getCookie(req: Request, res: Response) {
        
        res.send('success')
    }

    @HandleHttpRoute.get('/admin/register')
    @UtilFuncs.routeHandlerCatchError()
    static async clientRegister(req: Request, res: Response) {
        const reqUser = req.session.user
        res.render('admin', UtilFuncs.getRenderAdminPageData(reqUser))
    }

    @HandleHttpRoute.get('/admin/login')
    @UtilFuncs.routeHandlerCatchError()
    static async renderLogin(req: Request, res: Response) {
        const reqUser = req.session.user
        res.render('admin', UtilFuncs.getRenderAdminPageData(reqUser))
    }

    @HandleHttpRoute.get('/admin/main')
    @UtilFuncs.routeHandlerCatchError()
    static async renderAdminPage(req: Request, res: Response) {
        const reqUser = req.session.user
        res.render('admin', UtilFuncs.getRenderAdminPageData(reqUser))
    }

    @HandleHttpRoute.get('/api/admin/userinfo')
    @UtilFuncs.routeHandlerCatchError()
    static async getUserInfo(req: Request, res: Response) {
        const reqUser = req.session.user
        if (!reqUser) {
            throw new ResponseError('尚未登录')
        }
        res.json({
            code: 0,
            user: {
                ...reqUser,
                password: undefined
            },
        })
    }

    @HandleHttpRoute.post('/api/admin/register')
    @UtilFuncs.routeHandlerCatchError()
    static async registerSuperAdmin(req: Request, res: Response) {
        const { token, userName, password } = req.body
        const isValid = await UtilFuncs.validateSuperAdminToken(token)
        if (!isValid) {
            throw new ResponseError('无效注册码')
        }
        const findUser = await User.findByIndex('name', userName)
        if (findUser) {
            throw new ResponseError('用户名被占用')
        }
        const user = new User({
            name: userName,
            status: UserStatus.superAdmin,
        })
        user.setPassword(password)
        await user.save()
        await UtilFuncs.useSuperAdminToken(token)
        res.json({
            code: 0
        })
    }

    @HandleHttpRoute.get('/api/admin/checktoken')
    @UtilFuncs.routeHandlerCatchError()
    static async checkSuperAdminToken(req: Request, res: Response) {
        const { token } = req.query
        const isValid = await UtilFuncs.validateSuperAdminToken(token)
        if (!isValid) {
            throw new ResponseError('无效注册码')
        }
        res.json({
            code: 0
        })
    }

    @HandleHttpRoute.post('/api/admin/login')
    @UtilFuncs.routeHandlerCatchError()
    static async superAdminLogin(req: Request, res: Response) {
        const { userName, password } = req.body
        const reqUser = req.session.user
        if (isSuperAdmin(reqUser)) {
            throw new ResponseError('您已经登录为超级管理员')
        }
        const findUser = await User.findByIndex('name', userName)
        if (!findUser) {
            throw new ResponseError('invalid user name')
        }
        if (!isSuperAdmin(findUser)) {
            throw new ResponseError('越权操作')
        }
        if (!findUser.comparePassword(password)) {
            throw new ResponseError('密码错误')
        }
        if (req.session.isAuthenticated) {
            const sessionUser = req.session.user
            if (sessionUser.id === findUser.id) {
                throw new ResponseError('请不要重复登录')
            }
            const socketId = UtilFuncs.getUserNowSocketId(sessionUser.id)
            Actions.updateSocketStatus([socketId], ScoketStatus.closed)
            Actions.closeUsersScoket([sessionUser])
            await req.session.logOut()
        }
        await req.session.login(findUser)
        res.json({
            code: 0
        })
    }

    @HandleHttpRoute.post('/api/admin/logout')
    @UtilFuncs.routeHandlerCatchError()
    static async superAdminLogOut(req: Request, res: Response) {
        if (!req.session.isAuthenticated) {
            throw new ResponseError('已退出, 请不要重复操作')
        }
        const sessionUser = req.session.user
        if (!isSuperAdmin(sessionUser)) {
            throw new Error('越权操作')
        }
        const socketId = UtilFuncs.getUserNowSocketId(sessionUser.id)
        Actions.updateSocketStatus([socketId], ScoketStatus.closed)
        Actions.closeUsersScoket([sessionUser])
        await req.session.logOut()
        const defaultUserId = req.session.storeData.defaultUserId
        const defaultUser = await User.findOne(defaultUserId)
        if (defaultUser) {
            await req.session.login(defaultUser)
        }
        res.json({
            code: 0
        })
    }

}

export default async function (io: SocketIO.Server, app: Express, afterInit: () => any) {
    await beforeStart()
    HandleHttpRoute.listen(app)
    app.use((err, req, res, next) => {
        console.error(err)
        next()
    })
    io.on('connection', async (socket) => {
        // 判断是否登录
        if (!socket.session.isAuthenticated) {
            return Actions.updateSocketStatus([socket.id], ScoketStatus.invalid)
        }
        // handle connect
        Handler.connected(socket)

        // handle disconnect
        socket.on(ServerListenSocketEvents.disconnect, async function (reason) {
            const socket = this
            if (socket.session.isAuthenticated) {
                const user = await User.findOne(socket.session.user.id)
                socket.session.user = user
            }
            Handler.disConnect(socket, reason)
        })
        // 其他业务相关事件注册
        ListenSocket.listen(socket)
    })
    afterInit()
}

export {
    UtilFuncs,
    DestroyRoom,
    RoomRoutineLoopTasks,
}