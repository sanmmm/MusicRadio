import socketIo from 'socket.io'

import settings from 'root/settings'
import redisCli from 'root/lib/redis'
import session from 'root/lib/session'
import { User, Room } from 'root/lib/models'
import { SessionTypes, ServerListenSocketEvents, ClientListenSocketEvents, UserModel, RoomModel } from 'root/type'

function catchError(target, propertyName, descriptor: PropertyDescriptor): any {
    const func = descriptor.value
    return async (...args) => {
        try {
            func(...args)
        } catch (e) {
            console.error
        }
    }
}

export async function beforeStart() {
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

class Handler {
    @catchError
    static async handleJoinRoom (socket: socketIo.Socket, msg: {roomId: string}) {
        const reqUser = socket.session.user
        const {id: userId, ip: userIp} = reqUser
        const { roomId } = msg
        const room = await Room.findOne(roomId || hallRoomId)
        let errMsg = ''
        if (!room) {
            errMsg = '该房间不存在'
        } else if (
            room.blockIps.includes(userIp) || room.blockUsers.includes(userId)
        ) {
            errMsg = '该房间访问受限'
        } else if (room.heat === room.max){
            errMsg = '该房间已满员'
        }

        if (errMsg) {
            socket.send(ClientListenSocketEvents.notification, {msg: errMsg})
            return
        }

        room.heat ++
        reqUser.nowRoomId = room.id
        await reqUser.save()
        await room.save()
    }
}
export default async function (server) {
    await beforeStart()
    const io = socketIo(server, {
        origins: '*:*'
    })
    io.use((socket, next) => {
        session(SessionTypes.ip)(socket.request, () => {
            socket.session = socket.request.session
            next()
        })
    })
    io.use(async (socket, next) => {
        const session = socket.session
        if (!session.user && !!session.id) {
            let userDoc = await User.findOne(session.id)
            if (!userDoc) {
                userDoc = new User({
                    id: session.id,
                    ip: session.ip,
                })
            }
            userDoc.ip = socket.session.ip
            await userDoc.save()
            session.user = userDoc
            session.isAuthenticated = true
        }
        next()
    })
    io.on('connection', (socket) => {
        console.log(socket.session.id, 'session')
        if (!socket.session.isAuthenticated) {
            return
        }
        socket.on(ServerListenSocketEvents.joinRoom, Handler.handleJoinRoom)
    })
}