import socketIo from 'socket.io'
import socketIoRedis from 'socket.io-redis'
import socketIoEmitter from 'socket.io-emitter'

import settings from 'root/settings'
import redisCli from 'root/lib/redis'
import session from 'root/lib/session'
import { User, Room } from 'root/lib/models'
import {
    SessionTypes, ServerListenSocketEvents, ClientListenSocketEvents, UserModel, RoomModel,
    MessageItem, PlayListItem, ScoketStatus, MessageTypes, AdminAction, AdminActionTypes, RoomStatus
} from 'root/type'
import { catchError, isSuperAdmin, hideIp, safePushArrItem, safeRemoveArrItem } from 'root/lib/utils'
import emojiData from 'root/emojiData'

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
    static async pausePlaying(users: (UserModel | string)[]) {
        Actions.emit(users, ClientListenSocketEvents.pausePlaying, {
        })
    }
    @catchError
    static async startPlaying(users: (UserModel | string)[]) {
        Actions.emit(users, ClientListenSocketEvents.startPlaying, {
        })
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
    static async movePlayListItem(users: (UserModel | string)[], data: { fromId: string; toId: string }) {
        Actions.emit(users, ClientListenSocketEvents.movePlayListItems, {
            data
        })
    }
    @catchError
    static async blockPlayListItems(users: (UserModel | string)[], ids: string[]) {
        Actions.emit(users, ClientListenSocketEvents.blockPlayListItems, {
            data: ids
        })
    }
    @catchError
    static async recommendRoomList(users: (UserModel | string)[], data: any[]) {
        Actions.emit(users, ClientListenSocketEvents.recieveRoomList, {
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
            Actions.emit([user], ClientListenSocketEvents.userInfoChange, {
                data: {
                    ...user,
                    ...appendInfo
                }
            })
        })
    }

    @catchError
    static async notification (users: (UserModel | string)[], msg: string) {
        Actions.emit(users, ClientListenSocketEvents.userInfoChange, {
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
}

class Handler {
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
                // TODO
            } else {
                room.quit(reqUser)
                await room.save()
                reqUser.nowRoomId = null
                await reqUser.save()
            }
        }
    }

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
        if (room.status === RoomStatus.created) {
            if (reqUser.id !== room.creator) {
                errMsg = '该房间尚未开放'
            } else {
                room.status = RoomStatus.active
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
        // TODO
    }

    @catchError
    static async destroyRoom(socket: SocketIO.Socket, msg: { roomId: string }) {
        const { roomId } = msg
        const reqUser = socket.session.user
        const room = await Room.findOne(roomId)
        if (!isSuperAdmin(reqUser) || room.creator !== reqUser.id) {
            throw new Error('越权操作')
        }
        const joiners = await User.update(room.joiners, (item) => {
            item.nowRoomId = null
            item.allowComment = true
            return item
        })
        await room.remove()
        Actions.userInfoChange(joiners)
        Actions.notification([reqUser], '房间删除成功!')
        Actions.notification(room.joiners.filter(id => id !== reqUser.id), '房间已被管理员销毁')
    }

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

    @catchError
    static async pausePlaying(socket: SocketIO.Socket, msg: { roomId: string }) {
        const { roomId } = msg
        const reqUser = socket.session.user
        const room = await Room.findOne(roomId)
        if (!isSuperAdmin(reqUser) && room.creator !== reqUser.id) {
            throw new Error('越权操作')
        }
        room.nowPlayingInfo.isPaused = true
        await room.save()
        Actions.pausePlaying(room.joiners)
    }

    @catchError
    static async startPlaying(socket: SocketIO.Socket, msg: { roomId: string }) {
        const { roomId } = msg
        const reqUser = socket.session.user
        const room = await Room.findOne(roomId)
        if (!isSuperAdmin(reqUser) && room.creator !== reqUser.id) {
            throw new Error('越权操作')
        }
        room.nowPlayingInfo.isPaused = false
        await room.save()
        Actions.pausePlaying(room.joiners)
    }

    @catchError
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

    @catchError
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

    @catchError
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

    @catchError
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

    @catchError
    static async revokeAdminAction (socket: SocketIO.Socket, msg: { roomId: string, actionId: string }) {
        const {roomId,  actionId } = msg
        const reqUser = socket.session.user
        const room = await Room.findOne(roomId)
        if (!isSuperAdmin(reqUser) && room.creator !== reqUser.id) {
            throw new Error('越权操作')
        }
        const action = room.adminActions.find(item => item.id === actionId)
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

    @catchError
    static async addPlayListItems(socket: SocketIO.Socket, msg: { roomId }) {
        const { roomId } = msg
        const reqUser = socket.session.user
        const room = await Room.findOne(roomId)
        if (!isSuperAdmin(reqUser) && room.creator !== reqUser.id) {
            throw new Error('越权操作')
        }
        room.nowPlayingInfo.isPaused = false
        await room.save()
        Actions.pausePlaying(room.joiners)
    }

}

export default async function (server) {
    await beforeStart()
    const io = socketIo(server, {
        origins: '*:*'
    })
    io.adapter(socketIoRedis({ port: settings.redisPort, host: settings.redisHost }))
    io.use((socket, next) => {
        session(SessionTypes.ip)(socket.request, () => {
            socket.session = socket.request.session
            next()
        })
    })

    io.on('connection', async (socket) => {
        console.log(socket.session.id, 'session')
        if (!socket.session.isAuthenticated) {
            return Actions.updateSocketStatus([socket.id], ScoketStatus.invalid)
        }
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
                if (room.blockIps.includes(ip) || room.blockUsers.includes(userId)) {
                    return Actions.updateSocketStatus([socket.id], ScoketStatus.roomBlocked)
                }
            } else {
                await Handler.handleJoinRoom(socket, {roomId: hallRoomId})
            }
        }
        Actions.updateSocketStatus([socket.id], ScoketStatus.connected)
        
        socket.on('disconnect', Handler.disConnect.bind(Handler, socket))
        socket.on(ServerListenSocketEvents.joinRoom, Handler.handleJoinRoom)
    })
}