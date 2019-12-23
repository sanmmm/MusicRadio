import uuid from 'uuid/v4'

import settings from 'root/settings'
import {isSuperAdmin} from 'root/lib/utils'
import redisCli from 'root/lib/redis'
import {UserModel, RoomModel, ModelBase, StaticModelClass, MessageItem, PlayListItem, AdminAction, RoomStatus} from 'root/type'

class BaseModel {
    id: string;
    protected isInit: boolean = true;
    constructor (obj = {}) {
        Object.assign(this, obj)
    }
    static generateKey (id: string) {
        return `musicradio-modelid:${id}`
    }
    static async find (ids: string[]) {
        ids = ids.map(BaseModel.generateKey)
        const dataArr = (await redisCli.mget(...ids)) || []
        return dataArr.map(str => str && this.fromJson(str) as any)
    }
    static async findOne (id: string) {
        id = BaseModel.generateKey(id)
        const dataStr = await redisCli.get(id)
        return dataStr && this.fromJson(dataStr) as any
    }
    static async delete (ids: string[]) {
        ids = ids.map(BaseModel.generateKey)
        await redisCli.del(...ids)
    }
    static async update (ids: string[], cb) {
        ids = ids.map(BaseModel.generateKey)
        const dataArr = await BaseModel.find(ids)
        const map = new Map<string, string>()
        const updatedItems = []
        dataArr.forEach((item) => {
            const updatedItem = cb(item)
            map.set(BaseModel.generateKey(item.id), updatedItem.toJson())
            updatedItems.push(updatedItem)
        })
        await redisCli.mset(map)
        return updatedItems
    }
    static fromJson (str: string) {
        const obj =new this(JSON.parse(str))
        obj.isInit = false
        return obj
    }
    toJson () {
        return JSON.stringify(this)
    }
    async save () {
        if (!this.id) {
            this.id = uuid().replace(/-/g, '')
        }
        if (this.isInit) {
            const hasExisted = await redisCli.exists(BaseModel.generateKey(this.id))
            if (hasExisted) {
                throw new Error(`duplicated id: ${this.id}`)
            }
            this.isInit = false
        }
        await redisCli.set(BaseModel.generateKey(this.id), JSON.stringify(this))
        return this
    }
    async remove () {
        if (!this.id) {
            throw new Error(`invalid id: ${this.id}`)
        }
        await redisCli.del(BaseModel.generateKey(this.id))
        return this
    }
}

function defineModel <U, T extends StaticModelClass> (m: T) {
    return m as (StaticModelClass<U> & T)
}

class UserModelDef extends BaseModel implements UserModel {
    isSuperAdmin: boolean = false;
    nowRoomId: string;
    ip: string;
    blockPlayItems: string[] = [];
    allowComment = true;
}

export const User = defineModel<UserModelDef, typeof UserModelDef>(UserModelDef)

class RoomModelDef extends BaseModel implements RoomModel {
    creator: string;
    status: RoomStatus = RoomStatus.active;
    isPublic: boolean = true;
    isHallRoom: boolean = false; // 是否为大厅
    max: number;
    heat: number = 1;
    name: string;
    nowPlayingInfo: {
        id: string;
        name: string;
        artist: string;
        src: string;
        lyric: string;
        pic: string;
        isPaused: boolean;
        duration: number;
        progress: number; // 用小数来表示播放进度的百分比
        endAt: number; // timestamp 秒
        comment: {
            content: string;
            userId: number;
            avatarUrl: string;
            nickName: string;
        };
    };
    joiners: string[] = [];
    banUsers: string[] = [];
    blockIps: string[] = [];
    blockUsers: string[] = [];
    messageHistory: MessageItem[] = [];
    playList: PlayListItem[] = [];
    adminActions: AdminAction[] = [];

    static getRoomListKey () {
        return 'musicradio:roomlist'
    }

    static async getRoomIdList () {
        return redisCli.smembers(this.getRoomListKey())
    }

    async save () {
        let isInit = this.isInit
        const res = await super.save()
        if (isInit && this.id !== hallRoomId) {
            await redisCli.sadd(Room.getRoomListKey(), this.id)
        }
        return res
    }

    async remove () {
        const res = await super.remove()
        await redisCli.srem(Room.getRoomListKey(), this.id)
        return res
    }

    join (user: UserModel) {
        const isAdmin = isSuperAdmin(user)
        if (!isAdmin) {
            if (this.heat === this.max) {
                throw new Error('房间超员')
            }
            this.heat ++
        }
        this.joiners = Array.from(new Set(this.joiners).add(user.id))
    }

    quit (user: UserModel) {
        const findIndex = this.joiners.indexOf(user.id)
        if (findIndex > -1) {
            this.joiners.splice(findIndex, 1)
            !isSuperAdmin(user) && this.heat--
        }
    }
}

export const Room = defineModel<RoomModelDef, typeof RoomModelDef>(RoomModelDef)