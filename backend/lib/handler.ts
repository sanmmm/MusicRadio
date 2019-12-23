import socketIo from 'socket.io'
import socketIoRedis from 'socket.io-redis'
import socketIoEmitter from 'socket.io-emitter'

import settings from 'root/settings'
import session from 'root/lib/session'
import { User, Room } from 'root/lib/models'
import * as NetEaseApi from 'root/lib/api'
import * as CronTask from 'root/lib/taskCron'
import redisCli from 'root/lib/redis'
import BlockMusicList from 'root/config/blockMusic'
import emojiData from 'root/config/emojiData'
import {
    SessionTypes, ServerListenSocketEvents, ClientListenSocketEvents, UserModel, RoomModel,
    MessageItem, PlayListItem, ScoketStatus, MessageTypes, AdminAction, AdminActionTypes, RoomStatus,
    MediaTypes, CronTaskTypes
} from 'root/type'
import { catchError, isSuperAdmin, hideIp, safePushArrItem, safeRemoveArrItem, throttle as throttleAction } from 'root/lib/utils'

const socketEmiiter = socketIoEmitter({ host: settings.redisHost, port: settings.redisPort })

async function beforeStart() {
    const room = await Room.findOne(hallRoomId)
    if (!room) {
        const room = new Room({
            id: hallRoomId,
            isHallRoom: true,
            banUsers: [],
            blockIps: [],
            blockUsers: [],
        })
        await room.save()
    }
}

const UserToSocketIdMap: {
    [userId: string]: string
} = {}

const IpToUsersMap: {
    [ip: string]: string[]
} = {}

namespace ListenSocket {
    type Handler = (socket: socketIo.Socket, data: any, actionId?: string) => any
    const map = new Map<string, Set<Handler>>() 
    export function register(event: ServerListenSocketEvents) {
        return (target, propertyName: string, descriptor: PropertyDescriptor) => {
            const prevFunc: Handler = descriptor.value
            let funcSet = map.get(event)
            if (!funcSet) {
                funcSet = new Set()
                map.set(event, funcSet)
            }
            const newFunc = (socket: socketIo.Socket, data: any) => {
                prevFunc(socket, data, data.actionId)
            }
            funcSet.add(newFunc)
            descriptor.value = newFunc
            return descriptor as TypedPropertyDescriptor<Handler>
        }
    }

    export function listen (socket: socketIo.Socket) {
        map.forEach((funcSet, event) => {
            funcSet.forEach(handler => {
                socket.on(event, handler)
            })
        })
    } 
}

namespace ModelUtils {
    export async function destroyRoom (room: RoomModel) {
        const joiners = await User.update(room.joiners, (item) => {
            item.nowRoomId = null
            item.allowComment = true
            return item
        })
        await room.remove()
        return joiners
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
        @catchError
        static async handleDestroy (data: cronData) {
            const {roomId} = data
            const room = await Room.findOne(roomId)
            const joiners = await ModelUtils.destroyRoom(room)
            Actions.notification(joiners, '该房间已被销毁')
            Actions.userInfoChange(joiners)
        }
    }

    CronTask.listen(CronTaskTypes.destroyRoom, UtilFunc.handleDestroy)

    export async function destroy (room: RoomModel) {
        const cronData: cronData = {
            roomId: room.id
        }
        const expire = 60 * 5
        const redisKey = getRoomRecordKey(room.id)
        
        const oldJobRecord: DestroyRecord = JSON.parse(await redisCli.safeGet(redisKey))
        if (oldJobRecord) {
            await CronTask.cancelCaronTask(oldJobRecord.cronJobId)
            await redisCli.del(redisKey)
        }
        const jobId = await CronTask.pushCronTask(CronTaskTypes.destroyRoom, cronData, expire)
        await redisCli.safeSet(redisKey, JSON.stringify({
            cronJobId: jobId,
            prevRoomStatus: room.status
        } as DestroyRecord), expire)
        room.status = RoomStatus.willDestroy
        await room.save()
        return room
    }

    export async function cancelDestroy (room: RoomModel) {
        if (room.status !== RoomStatus.willDestroy) {
            return
        } 
        const redisKey = getRoomRecordKey(room.id)
        const record: DestroyRecord = JSON.parse(await redisCli.get(redisKey))
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

namespace ManageRoomPlaying {
    interface CronJobData {
        roomId: string;
    }

    const getRoomToJobIdKey = (roomId: string) => `musicradio:playing:${roomId}`
    
    class UtilFunc {
        // 上一首播放结束后按照播放列表自动切换
        @catchError
        static async handleSwitchPlaying (data: CronJobData) {
            const {roomId} = data
            const room = await Room.findOne(roomId)
            const leftPlayList = room.playList
            leftPlayList.shift()
            room.nowPlayingInfo = null
            await room.save()
            if (!leftPlayList.length) {
                console.log(`房间: ${room.id}列表播放结束`)
                return
            }
            await startPlaying(room)
        }

    }

    async function setSwitchMusicCronJob (room: RoomModel) {
        const jobIdRedisKey = getRoomToJobIdKey(room.id)
        const oldJobId = await redisCli.get(jobIdRedisKey)
        if (oldJobId) {
            await CronTask.cancelCaronTask(oldJobId)
            await redisCli.del(jobIdRedisKey)
        }
        
        const {progress, duration} = room.nowPlayingInfo
        const leftSecond = (1 - progress) * duration
        const data: CronJobData = {
            roomId: room.id,
        }
        // 播放进度为100% 或极度接近100%, 结束播放
        if (leftSecond < 0.3) {
            UtilFunc.handleSwitchPlaying(data)
            return
        }
        const newlyjobId = await CronTask.pushCronTask(CronTaskTypes.cutMusic, data, leftSecond)
        await redisCli.safeSet(jobIdRedisKey, newlyjobId, leftSecond)
    }

    async function cancelSwitchMusicJob (room: RoomModel) {
        const jobIdRedisKey = getRoomToJobIdKey(room.id)
        const jobId = await redisCli.safeGet(jobIdRedisKey)
        if (!jobId) {
            return
        }
        await CronTask.cancelCaronTask(jobId)
        await redisCli.del(jobIdRedisKey)
    }

    CronTask.listen<CronJobData>(CronTaskTypes.cutMusic, UtilFunc.handleSwitchPlaying)

    export async function getPlayItemDetailInfo (playItemId: string) {
        const [musicInfo] = await NetEaseApi.getMusicInfo([playItemId])
        const {id, name, artist, lyric, src, pic, duration, comments} = musicInfo
        let selectedComment = null, lineCount = 0
        comments.forEach((c, index) => { // 选取换行符最少的评论
            const nowLineCount = c.content.split('\n').length
            if (index === 0 || nowLineCount < lineCount) {
                selectedComment = c
                selectedComment.content = c.content.replace(/\n/g, ' ')
                lineCount = nowLineCount
            }
        })
        const comment = selectedComment;
        const nowPlayingInfo: RoomModel['nowPlayingInfo'] = {
            isPaused: true,
            id,
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

    export async function startPlaying (room: RoomModel) {
        let nowPlayingInfo: RoomModel['nowPlayingInfo'] = room.nowPlayingInfo
        if (!nowPlayingInfo) {
            if (!room.playList.length) {
                console.log(`当前房间:${room.id}播放内容为空！`)
                return
            }
            nowPlayingInfo = await getPlayItemDetailInfo(room.playList[0].id)
            room.nowPlayingInfo = nowPlayingInfo
            await room.save()
        }
        if (!nowPlayingInfo.isPaused) {
            return
        }
        
        const {duration, progress = 0} = nowPlayingInfo
        const endAt = Date.now() / 1000 + (duration * progress)
        room.nowPlayingInfo.endAt = endAt
        room.nowPlayingInfo.isPaused = true
        await room.save()
        await setSwitchMusicCronJob(room)
        Actions.sendNowRoomPlayingInfo(room, room.joiners)
    }

    export async function pausePlaying (room: RoomModel) {
        await cancelSwitchMusicJob(room)
        const {duration, endAt} = room.nowPlayingInfo
        const leftTime = endAt - Date.now() / 1000
        if (leftTime < 0) {
            throw new Error('invalid expireAt')
        }
        Object.assign(room.nowPlayingInfo, {
            isPaused: true,
            progress: ((duration - leftTime) / duration).toFixed(2),
        })
        await room.save()
        Actions.sendNowRoomPlayingInfo(room, room.joiners)
    }

    export async function changePlayingProgress (room: RoomModel, progressRate: number) {
        if (progressRate > 1 || progressRate < 0) {
            throw new Error('invalid progress rate')
        }
        await cancelSwitchMusicJob(room)
        room.nowPlayingInfo.progress = progressRate
        await room.save()
        if (!room.nowPlayingInfo.isPaused) {
            const {progress, duration} = room.nowPlayingInfo
            room.nowPlayingInfo.endAt = Date.now() / 1000 + progress * duration
            await room.save()
            await setSwitchMusicCronJob(room)
        }
        Actions.sendNowRoomPlayingInfo(room, room.joiners)
    }
}

class Actions {
    static usersToSocketIds(users: (UserModel | string)[]) {
        return users.map(user => UserToSocketIdMap[typeof user === 'string' ? user : user.id])
    }
    static emit(users: (UserModel | string)[], eventName: string, data: any) {
        const socketIds = Actions.usersToSocketIds(users)
        socketIds.forEach(id => {
            socketEmiiter.to(id).emit(eventName, data)
        })
    }
    @catchError
    static async sendNowRoomPlayingInfo(room: RoomModel, users: (UserModel | string)[]) {
        const sendData = {
            data: room.nowPlayingInfo
        }
        Actions.emit(users, ClientListenSocketEvents.recieveNowPlayingInfo, sendData)
    }
    @catchError
    static async addChatListMessages(users: (UserModel | string)[], messages: MessageItem[]) {
        Actions.emit(users, ClientListenSocketEvents.addChatListMessages, {
            data: messages
        })
    }
    @catchError
    static async addPlayListItems(users: (UserModel | string)[], items: PlayListItem[]) {
        Actions.emit(users, ClientListenSocketEvents.addPlayListItems, {
            data: items
        })
    }
    @catchError
    static async deletePlayListItems(users: (UserModel | string)[], ids: string[]) {
        Actions.emit(users, ClientListenSocketEvents.deletePlayListItems, {
            data: ids
        })
    }
    @catchError
    static async movePlayListItem(users: (UserModel | string)[], data: { fromIndex: number; toIndex: number }) {
        Actions.emit(users, ClientListenSocketEvents.movePlayListItem, {
            data
        })
    }
    @catchError
    static async sendSearchResult (users: (UserModel | string)[], data: { actionId: string; list: any[] }) {
        Actions.emit(users, ClientListenSocketEvents.searchMediaResult, {
            data: data.list,
            actionId: data.actionId,
        })
    }

    @catchError
    static async sendMediaDetail (users: (UserModel | string)[], data: { actionId: string; detail: any }) {
        Actions.emit(users, ClientListenSocketEvents.updateMediaDetail, {
            data: data.detail,
            actionId: data.actionId,
        })
    }
    
    @catchError
    static async recommendRoomList(users: (UserModel | string)[], data: any[]) {
        Actions.emit(users, ClientListenSocketEvents.updatRecommenedRoomList, {
            data
        })
    }
    
    @catchError
    static async createRoomSuccess (user: (UserModel | string), roomId: string) {
        Actions.emit([user], ClientListenSocketEvents.createRoomSuccess, {
            data: roomId
        })
    }
    
    @catchError
    static async userInfoChange(users: UserModel[], appendInfo: Object = {}) {
        users.forEach(user => {
            Actions.emit([user], ClientListenSocketEvents.updateUserInfo, {
                data: {
                    ...user,
                    ...appendInfo
                }
            })
        })
    }
    
    @catchError
    static async notification (users: (UserModel | string)[], msg: string) {
        Actions.emit(users, ClientListenSocketEvents.updateUserInfo, {
            data: msg
        })
    }
    
    @catchError
    static async updateSocketStatus (socketIds: string[], status: ScoketStatus) {
        socketIds.forEach(id => {
            socketEmiiter.to(id).emit(ClientListenSocketEvents.updateSocketStatus, {
                data: status
            })
        })
    }

    @catchError
    static async updateEmojiList (users: (UserModel | string)[], emojiList: any[]) {
        Actions.emit(users, ClientListenSocketEvents.updateUserInfo, {
            data: emojiList
        })
    }
}

class Handler {
    @catchError
    static async connected (socket: socketIo.Socket) {
        const {user, user: {id: userId}, ip} = socket.session
        const prevUserSocketId = UserToSocketIdMap[userId]
        UserToSocketIdMap[userId] = socket.id
        if (prevUserSocketId) {
            Actions.updateSocketStatus([prevUserSocketId], ScoketStatus.closed)
        }

        if (!isSuperAdmin(user) ) {
            const hallRoom = await Room.findOne(hallRoomId)
            if (hallRoom.blockIps.includes(ip) || hallRoom.blockUsers.includes(userId)) {
                return Actions.updateSocketStatus([socket.id], ScoketStatus.globalBlocked)
            }
            if (user.nowRoomId) {
                const room = await Room.findOne(user.nowRoomId)
                if (user.id === room.creator && room.status === RoomStatus.willDestroy) {
                    // 房间创建者在一定时间内断线重连，则取消自动销毁房间的定时任务
                    await DestroyRoom.cancelDestroy(room)
                }
                if (room.blockIps.includes(ip) || room.blockUsers.includes(userId)) {
                    return Actions.updateSocketStatus([socket.id], ScoketStatus.roomBlocked)
                }
            }
        }
        Actions.updateSocketStatus([socket.id], ScoketStatus.connected)
        
    }

    @catchError
    static async disConnect(socket: socketIo.Socket, reason: string) {
        const { user: reqUser } = socket.session
        const nowUserSocketId = UserToSocketIdMap[reqUser.id]
        if (nowUserSocketId !== socket.id) {
            return
        }
        UserToSocketIdMap[reqUser.id] = null
        if (reqUser.nowRoomId) {
            const room = await Room.findOne(reqUser.nowRoomId)
            if (room.creator === reqUser.id) {
                // 定时任务: 如果房间创建者没有重新上线, 五分钟后销毁房间
                await DestroyRoom.destroy(room)
            } else {
                room.quit(reqUser)
                await room.save()
                reqUser.nowRoomId = null
                await reqUser.save()
            }
        }
    }

    @ListenSocket.register(ServerListenSocketEvents.joinRoom)
    @catchError
    static async handleJoinRoom(socket: socketIo.Socket, msg: { roomId: string }) {
        const reqUser = socket.session.user
        const { id: userId, ip: userIp } = reqUser
        const { roomId = hallRoomId } = msg
        if (reqUser.nowRoomId) {
            if (reqUser.nowRoomId === roomId) {
                return
            } else {
                throw new Error('请先退出前面的房间')
            }
        }

        const room = await Room.findOne(roomId)
        let errMsg = ''

        if (!room) {
            errMsg = '该房间不存在'
        } else if (
            room.blockIps.includes(userIp) || room.blockUsers.includes(userId)
        ) {
            errMsg = '该房间访问受限'
        } else if (room.heat === room.max) {
            errMsg = '该房间已满员'
        }

        const isInitial = room.joiners.length === 0
        if (isInitial) {
            if (reqUser.id !== room.creator) {
                errMsg = '该房间尚未开放'
            } else {
                await DestroyRoom.cancelDestroy(room)
            }
        }
        if (errMsg) {
            socket.send(ClientListenSocketEvents.notification, { msg: errMsg })
            return
        }

        room.join(reqUser)
        await room.save()
        reqUser.nowRoomId = room.id
        reqUser.allowComment = !room.banUsers.includes(reqUser.id)
        await reqUser.save()
        Actions.userInfoChange([reqUser])
    }

    @ListenSocket.register(ServerListenSocketEvents.getRoomData)
    @catchError
    static async loadRoomData(socket: SocketIO.Socket, msg: { roomId: string }) {
        const { roomId } = msg
        const reqUser = socket.session.user
        if (reqUser.nowRoomId !== roomId) {
            throw new Error('越权访问')
        }
        const room = await Room.findOne(roomId)
        Actions.sendNowRoomPlayingInfo(room, [reqUser])
        Actions.addChatListMessages([reqUser], room.messageHistory.slice(-10))
        Actions.addPlayListItems([reqUser], room.playList)
    }

    @ListenSocket.register(ServerListenSocketEvents.createRoom)
    @catchError
    static async createRoom(socket: SocketIO.Socket, msg: {
        name: string;
        isPrivate: boolean;
        maxMemberCount: number;
    }) {
        const { name, isPrivate, maxMemberCount } = msg
        const reqUser = socket.session.user
        const room = new Room({
            name,
            max: maxMemberCount,
            isPublic: !isPrivate,
            creator: reqUser.id,
        })
        await room.save()
        Actions.createRoomSuccess(reqUser, room.id)
        // 初始化好的房间 如果在一定时间内（暂定为5分钟）创建者没有加入，则自动销毁
        await DestroyRoom.destroy(room)
        // TODO
    }

    @ListenSocket.register(ServerListenSocketEvents.destroyRoom)
    @catchError
    static async destroyRoom(socket: SocketIO.Socket, msg: { roomId: string }) {
        const { roomId } = msg
        const reqUser = socket.session.user
        const room = await Room.findOne(roomId)
        if (!isSuperAdmin(reqUser) || room.creator !== reqUser.id) {
            throw new Error('越权操作')
        }
        const joiners = await ModelUtils.destroyRoom(room)
        Actions.userInfoChange(joiners)
        Actions.notification([reqUser], '房间删除成功!')
        Actions.notification(room.joiners.filter(id => id !== reqUser.id), '房间已被管理员销毁')
    }

    @ListenSocket.register(ServerListenSocketEvents.quitRoom)
    @catchError
    static async quitRoom (socket: SocketIO.Socket, msg: { roomId: string }) {
        const { roomId } = msg
        const reqUser = socket.session.user
        if (reqUser.nowRoomId !== roomId) {
            throw new Error('越权操作')
        }
        const room = await Room.findOne(roomId)
        if (reqUser.id === room.creator) {
            throw new Error('创建者请先销毁房间')
        }
        room.quit(reqUser)
        await room.save()
        reqUser.nowRoomId = null
        await reqUser.save()
        Actions.userInfoChange([reqUser])
      
    }

    @ListenSocket.register(ServerListenSocketEvents.pausePlaying)
    @catchError
    @throttleAction(3000)
    static async pausePlaying(socket: SocketIO.Socket, msg: { roomId: string }) {
        const { roomId } = msg
        const reqUser = socket.session.user
        const room = await Room.findOne(roomId)
        if (!isSuperAdmin(reqUser) && room.creator !== reqUser.id) {
            throw new Error('越权操作')
        }
        await ManageRoomPlaying.pausePlaying(room)
    }

    @ListenSocket.register(ServerListenSocketEvents.startPlaying)
    @catchError
    @throttleAction(3000)
    static async startPlaying(socket: SocketIO.Socket, msg: { roomId: string }) {
        const { roomId } = msg
        const reqUser = socket.session.user
        const room = await Room.findOne(roomId)
        if (!isSuperAdmin(reqUser) && room.creator !== reqUser.id) {
            throw new Error('越权操作')
        }
        await ManageRoomPlaying.startPlaying(room)
    }

    @ListenSocket.register(ServerListenSocketEvents.changeProgress)
    @catchError
    @throttleAction(3000)
    static async changeProgress (socket: SocketIO.Socket, msg: { roomId: string, progress: number }) {
        const { roomId, progress = 0} = msg
        const reqUser = socket.session.user
        const room = await Room.findOne(roomId)
        if (!isSuperAdmin(reqUser) && room.creator !== reqUser.id) {
            throw new Error('越权操作')
        }
        await ManageRoomPlaying.changePlayingProgress(room, progress)
    }


    @ListenSocket.register(ServerListenSocketEvents.sendMessage)
    @catchError
    @throttleAction(4000)
    static async sendMessages (socket: SocketIO.Socket, msg: {
        roomId: string;
        text?: string;
        emojiId?: string;
     }) {
        const { roomId, text, emojiId } = msg
        const reqUser = socket.session.user
        if (reqUser.nowRoomId !== roomId) {
            throw new Error('越权操作')
        }
        if (!text && !emojiId) {
            throw new Error('消息不能为空') 
        }
        // TODO 防注入
        const room = await Room.findOne(roomId)
        const isAdmin = isSuperAdmin(reqUser) || reqUser.id === room.creator
        let messageType, messageContent: any = {}
        if (text) {
            messageType = isAdmin ? MessageTypes.advanced : MessageTypes.normal
            messageContent = {
                text
            }
        }
        if (emojiId) {
            messageType = MessageTypes.emoji
            const emojiItem = emojiData.find(o => o.id === emojiId)
            if (!emojiItem) {
                throw new Error('invalid emoji id')
            }
            messageContent = {
                title: emojiItem.title,
                img: emojiItem.url 
            }
        }
        const message: MessageItem = {
            id: Date.now().toString(),
            fromId: reqUser.id,
            from: hideIp(reqUser.ip) || `匿名用户${reqUser.id.slice(0, 5)}`,
            tag: isAdmin ? '管理员' : '',
            time: new Date().toString(),
            content: messageContent,
            type: messageType
        }
        room.messageHistory.push(message)
        await room.save()
        Actions.addChatListMessages(room.joiners, [message])
    }

    @ListenSocket.register(ServerListenSocketEvents.blockUser)
    @catchError
    @throttleAction(2000)
    static async blockUser (socket: SocketIO.Socket, msg: { 
        roomId: string;
        userId: string;
    }) {
        const { roomId = hallRoomId, userId } = msg
        const reqUser = socket.session.user
        const room = await Room.findOne(roomId)
        if (!isSuperAdmin(reqUser) && room.creator !== reqUser.id) {
            throw new Error('越权操作')
        }
        const blockedUser = await User.findOne(userId)
        if (isSuperAdmin(blockedUser)) {
            throw new Error('不能屏蔽超级管理员')
        }
        if (!room.joiners.includes(userId)) {
            throw new Error('该用户不存在')
        }
        room.quit(blockedUser)
        room.blockUsers = safePushArrItem(room.blockUsers, blockedUser)
        room.adminActions.push({
            id: Date.now().toString(),
            type: AdminActionTypes.blockUser,
            isSuperAdmin: isSuperAdmin(reqUser),
            operator: reqUser.id,
            operatorName: reqUser.name || hideIp(reqUser.ip),
            room: roomId,
            time: Date.now(),
            detail: {
                userId
            }
        })
        await room.save()
        blockedUser.nowRoomId = null
        await blockedUser.save()
        Actions.userInfoChange([blockedUser])
    }

    @ListenSocket.register(ServerListenSocketEvents.blockUserIp)
    @catchError
    @throttleAction(2000)
    static async blockIp (socket: SocketIO.Socket, msg: { 
        roomId: string;
        userId: string; // 根据userid查到ip
    }) {
        const { roomId = hallRoomId, userId } = msg
        const reqUser = socket.session.user
        const room = await Room.findOne(roomId)
        if (!isSuperAdmin(reqUser) && room.creator !== reqUser.id) {
            throw new Error('越权操作')
        }
        const aimUser = await User.findOne(userId)
        const aimIp = aimUser.ip
        const roomUsers = await User.find(room.joiners)
        const blockedUsers: UserModel[] = []
        const tasks = roomUsers.map(async user => {
            if (isSuperAdmin(user)) {
                return
            }
            if (user.ip === aimIp) {
                blockedUsers.push(user)
                user.nowRoomId = null
                await user.save()
                room.quit(aimUser)
            }
        })
        await Promise.all(tasks)
        room.blockIps = safePushArrItem(room.blockIps, aimIp)
        room.adminActions.push({
            id: Date.now().toString(),
            type: AdminActionTypes.blockIp,
            isSuperAdmin: isSuperAdmin(reqUser),
            operator: reqUser.id,
            operatorName: reqUser.name || hideIp(reqUser.ip),
            room: roomId,
            time: Date.now(),
            detail: {
                ip: aimIp
            }
        })
        await room.save()
        Actions.userInfoChange(blockedUsers)
    }

    @ListenSocket.register(ServerListenSocketEvents.banUserComment)
    @catchError
    @throttleAction(2000)
    static async banUserComment (socket: SocketIO.Socket, msg: { 
        roomId: string;
        userId: string;
    }) {
        const { roomId = hallRoomId, userId } = msg
        const reqUser = socket.session.user
        const room = await Room.findOne(roomId)
        if (!isSuperAdmin(reqUser) && room.creator !== reqUser.id) {
            throw new Error('越权操作')
        }
        const aimUser = await User.findOne(userId)
        if (isSuperAdmin(aimUser)) {
            throw new Error('不能对超级管理员禁言')
        }
        room.banUsers = safePushArrItem(room.banUsers, aimUser)
        room.adminActions.push({
            id: Date.now().toString(),
            type: AdminActionTypes.banUserComment,
            isSuperAdmin: isSuperAdmin(reqUser),
            operator: reqUser.id,
            operatorName: reqUser.name || hideIp(reqUser.ip),
            room: roomId,
            time: Date.now(),
            detail: {
                userId
            }
        })
        await room.save()
        aimUser.allowComment = false;
        await aimUser.save()
        Actions.userInfoChange([aimUser])
    }

    @ListenSocket.register(ServerListenSocketEvents.revokeAction)
    @catchError
    @throttleAction(2000)
    static async revokeAdminAction (socket: SocketIO.Socket, msg: { roomId: string, revokeActionId: string }) {
        const {roomId, revokeActionId } = msg
        const reqUser = socket.session.user
        const room = await Room.findOne(roomId)
        if (!isSuperAdmin(reqUser) && room.creator !== reqUser.id) {
            throw new Error('越权操作')
        }
        const action = room.adminActions.find(item => item.id === revokeActionId)
        if (!action) {
            throw new Error('该操作不存在')
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
            if (aimUser) {
                aimUser.allowComment = true
                await aimUser.save()
                Actions.userInfoChange([aimUser])
            }
        }
        room.adminActions = safeRemoveArrItem(room.adminActions, action)
        await room.save()
    }


    @ListenSocket.register(ServerListenSocketEvents.blockPlayListItems)
    @catchError
    static async blockPlayListItems (socket: SocketIO.Socket, msg: { ids: string[] }) {
        const { ids = [] } = msg
        if (!ids.length) {
            return
        }
        const reqUser = socket.session.user
        reqUser.blockPlayItems = safePushArrItem(reqUser.blockPlayItems, ids)
        await reqUser.save()
    Actions.userInfoChange([reqUser])
    }

    @ListenSocket.register(ServerListenSocketEvents.unblockPlayListItems)
    @catchError
    static async unblockPlayListItems (socket: SocketIO.Socket, msg: { ids: string[] }) {
        const { ids = [] } = msg
        if (!ids.length) {
            return
        }
        const reqUser = socket.session.user
        reqUser.blockPlayItems = safeRemoveArrItem(reqUser.blockPlayItems, ids)
        await reqUser.save()
        Actions.userInfoChange([reqUser])
    }

    @ListenSocket.register(ServerListenSocketEvents.addPlayListItems)
    @catchError
    @throttleAction(3000)
    static async addPlayListItems (socket: SocketIO.Socket, msg: { ids: string[], roomId: string }) {
        const { ids = [], roomId } = msg
        if (!ids.length) {
            return
        }
        const musicIds = Array.from(new Set(ids))
        const reqUser = socket.session.user
        const room = await Room.findOne(roomId)
        const isSuper = isSuperAdmin(reqUser)
        if (!isSuper && !room.joiners.includes(reqUser.id)) {
            throw new Error('越权操作')
        }
        if (!isSuper && room.creator !== reqUser.id ) {
            // TODO 
        }
        const oldMusicIdSet = new Set(room.playList.map(i => i.id))
        const existed: string[] = [], newMusics = [], excluded = []
        for (let musicId of musicIds) {
            if (oldMusicIdSet.has(musicId)) {
                existed.push(musicId)
                continue
            }
            const [info] = await NetEaseApi.getMusicBaseInfo(musicId)
            const {id, name, artist, album, duration} = info
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
        room.playList = safePushArrItem(room.playList, newMusics)
        await room.save()
        await ManageRoomPlaying.startPlaying(room)
        const messages: string[] = []
        existed.length && messages.push(`${existed.length}首已在列表中`)
        excluded.length && excluded.forEach(name => messages.push(`《${name}》暂不支持播放`))
        newMusics.length && messages.push(`${newMusics.length}首添加成功!`)
        
        Actions.addChatListMessages([reqUser], messages.map(m => {
            return {
                id: Date.now().toString(),
                type: MessageTypes.notification,
                from: '系统消息',
                content: {
                    text: m
                },
                time: Date.now(),
            }
        }))
    }

    @ListenSocket.register(ServerListenSocketEvents.deletePlayListItems)
    @catchError
    @throttleAction(3000)
    static async deletePlayListItems (socket: SocketIO.Socket, msg: { ids: string[], roomId: string }) {
        const { ids = [], roomId } = msg
        if (!ids.length) {
            return
        }
        const toDelIds = new Set(ids)
        const reqUser = socket.session.user
        const room = await Room.findOne(roomId)
        if (!isSuperAdmin(reqUser) && room.creator !== reqUser.id) {
            throw new Error('越权操作')
        }
        
        let nowPlayingId, isRoomPlaying = false
        if (room.nowPlayingInfo) {
            const {id, isPaused} = room.nowPlayingInfo
            nowPlayingId = id
            isRoomPlaying = !isPaused
        }
        room.playList = room.playList.filter(item => !toDelIds.has(item.id))
        await room.save()
        if (toDelIds.has(nowPlayingId)) {
            await ManageRoomPlaying.pausePlaying(room)
            room.nowPlayingInfo = null
            await room.save()
        }

        if (!room.nowPlayingInfo && room.playList.length) {
            const playItemId = room.playList[0].id
            room.nowPlayingInfo = await ManageRoomPlaying.getPlayItemDetailInfo(playItemId)
            if (isRoomPlaying) {
                await ManageRoomPlaying.startPlaying(room)
            }
        }
        Actions.notification([reqUser], '删除成功')
        Actions.deletePlayListItems(room.joiners, Array.from(toDelIds))
        // Actions.addChatListMessages([reqUser], [
        //     {
        //         id: Date.now().toString(),
        //         type: MessageTypes.notification,
        //         from: '系统消息',
        //         content: {
        //             text: '删除成功'
        //         },
        //         time: Date.now(),
        //     }
        // ])
    }

    @ListenSocket.register(ServerListenSocketEvents.movePlayListItem)
    @catchError
    @throttleAction(3000)
    static async movePlayListItem (socket: SocketIO.Socket, msg: { 
        fromIndex: number;
        toIndex: number;
        roomId: string; 
    }) {
        const {fromIndex, toIndex, roomId} = msg
        if (fromIndex === toIndex) {
            return
        }
        const reqUser = socket.session.user
        const room = await Room.findOne(roomId)
        const isSuper = isSuperAdmin(reqUser)
        if (!isSuper && !room.joiners.includes(reqUser.id)) {
            throw new Error('越权操作')
        }
        const fromItem = room.playList[fromIndex]
        const toItem = room.playList[toIndex]
        if (!fromItem || !toItem ) {
            throw new Error('invalid index')
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
            const isRoomPlaying = room.nowPlayingInfo && !room.nowPlayingInfo.isPaused
            if (isRoomPlaying) {
                await ManageRoomPlaying.startPlaying(room)
            }
        }   
    }

    @ListenSocket.register(ServerListenSocketEvents.searchMedia)
    @catchError
    static async getEmojiList (socket: SocketIO.Socket, msg: {lastId: string }) {
        const { lastId } = msg
        const reqUser = socket.session.user
        const findIndex = lastId ? (emojiData.findIndex(e => e.id === lastId) + 1) : 0
        const list = emojiData.slice(findIndex, findIndex + 15)
        Actions.updateEmojiList([reqUser], list)
    }


    @ListenSocket.register(ServerListenSocketEvents.searchMedia)
    @catchError
    @throttleAction(5000)
    static async searchMedia (socket: SocketIO.Socket, msg: { keywords: string }, actionId: string) {
        const { keywords = '' } = msg
        if (!keywords.trim()) {
            return
        }
        const songs = await NetEaseApi.searchMedia(keywords, MediaTypes.song)
        const albums = await NetEaseApi.searchMedia(keywords, MediaTypes.album)        
        const all = songs.concat(albums)
        Actions.sendSearchResult([socket.session.user], {
            actionId,
            list: all
        })
    }

    @ListenSocket.register(ServerListenSocketEvents.getMediaDetail)
    @catchError
    @throttleAction(5000)
    static async getAlbumInfo (socket: SocketIO.Socket, msg: { id: string }, actionId: string) {
        const { id } = msg
        if (!id) {
            throw new Error('invalid id')
        }
        const albumInfo = await NetEaseApi.getAlbumInfo(id)
        const {name, desc, pic, musicList} = albumInfo
        Actions.sendMediaDetail([socket.session.user], {
            actionId,
            detail: {
                name,
                desc,
                pic,
                type: MediaTypes.album,
                list: musicList.map(m => {
                    const {name, id, pic} = m
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
    @catchError
    static async loadRoomList (socket: SocketIO.Socket, msg: {lastId}) {
        const { lastId } = msg
        const allRoomIds = await Room.getRoomIdList()
        const offset = lastId ? (allRoomIds.indexOf(lastId) + 1) : 0
        const rooms = await Room.find(allRoomIds.slice(offset, offset + 10))
        Actions.recommendRoomList([socket.session.user], rooms)
    }
}

export default async function (server) {
    await beforeStart()
    const io = socketIo(server, {
        origins: settings.origin || '*:*'
    })
    io.adapter(socketIoRedis({ port: settings.redisPort, host: settings.redisHost }))
    io.use((socket, next) => {
        session(SessionTypes.token)(socket.request, () => {
            socket.session = socket.request.session
            next()
        })
    })

    io.on('connection', async (socket) => {
        console.log(socket.session.id, 'session')
        if (!socket.session.isAuthenticated) {
            return Actions.updateSocketStatus([socket.id], ScoketStatus.invalid)
        }
        Handler.connected(socket)
        socket.on(ServerListenSocketEvents.disconnect, Handler.disConnect.bind(Handler, socket))
        ListenSocket.listen(socket)
    })
}