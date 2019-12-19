import socketIo from 'socket.io'
import socketIoRedis from 'socket.io-redis'
import socketIoEmitter from 'socket.io-emitter'

import settings from 'root/settings'
import redisCli from 'root/lib/redis'
import session from 'root/lib/session'
import { User, Room } from 'root/lib/models'
import {
    SessionTypes, ServerListenSocketEvents, ClientListenSocketEvents, UserModel, RoomModel,
    MessageItem, PlayListItem,
} from 'root/type'
import { catchError, isSuperAdmin } from 'root/lib/utils'

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
    static async userInfoChange(users: UserModel[]) {
        users.forEach(user => {
            Actions.emit([user], ClientListenSocketEvents.userInfoChange, {
                data: user
            })
        })
    }

    @catchError
    static async notification (users: (UserModel | string)[], msg: string) {
        Actions.emit(users, ClientListenSocketEvents.userInfoChange, {
            data: msg
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
        if (reqUser.nowRoomId) {
            const room = await Room.findOne(reqUser.nowRoomId)
            room.quit(reqUser)
            await room.save()
            reqUser.nowRoomId = null
            await reqUser.save()
        }
    }

    @catchError
    static async handleJoinRoom(socket: socketIo.Socket, msg: { roomId: string }) {
        const reqUser = socket.session.user
        const { id: userId, ip: userIp } = reqUser
        const { roomId = hallRoomId } = msg
        if (reqUser.nowRoomId) {
            const { nowRoomId } = reqUser
            if (nowRoomId === roomId) {
                return
            }
            await Room.update([nowRoomId], (item) => {
                item.quit(reqUser)
                return item
            })
            reqUser.nowRoomId = null
            await reqUser.save()
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
        if (errMsg) {
            socket.send(ClientListenSocketEvents.notification, { msg: errMsg })
            return
        }

        room.join(reqUser)
        await room.save()
        reqUser.nowRoomId = room.id
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
        Actions.addChatListMessages([reqUser], room.messageHistory)
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
        reqUser.nowRoomId = room.id
        await reqUser.save()
        Actions.userInfoChange([reqUser])
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
        room.quit(reqUser)
        await room.save()
        reqUser.nowRoomId = null
        await reqUser.save()
        Actions.userInfoChange([reqUser])
      
    }

    @catchError
    static async pausePlaying(socket: SocketIO.Socket, msg: { roomId }) {
        const { roomId } = msg
        const reqUser = socket.session.user
        const room = await Room.findOne(roomId)
        if (!isSuperAdmin(require) && room.creator !== reqUser.id) {
            throw new Error('越权操作')
        }
        room.nowPlayingInfo.isPaused = true
        await room.save()
        Actions.pausePlaying(room.joiners)
    }

    @catchError
    static async startPlaying(socket: SocketIO.Socket, msg: { roomId }) {
        const { roomId } = msg
        const reqUser = socket.session.user
        const room = await Room.findOne(roomId)
        if (!isSuperAdmin(require) && room.creator !== reqUser.id) {
            throw new Error('越权操作')
        }
        room.nowPlayingInfo.isPaused = false
        await room.save()
        Actions.pausePlaying(room.joiners)
    }

    @catchError
    static async addPlayListItems(socket: SocketIO.Socket, msg: { roomId }) {
        const { roomId } = msg
        const reqUser = socket.session.user
        const room = await Room.findOne(roomId)
        if (!isSuperAdmin(require) && room.creator !== reqUser.id) {
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

    io.on('connection', (socket) => {
        console.log(socket.session.id, 'session')
        if (!socket.session.isAuthenticated) {
            return
        }
        const userId = socket.session.user.id
        UserToSocketIdMap[userId] = socket.id

        socket.on('disconnect', Handler.disConnect.bind(Handler, socket))
        socket.on(ServerListenSocketEvents.joinRoom, Handler.handleJoinRoom)
    })
}