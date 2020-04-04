import uuid from 'uuid/v4'

import settings from 'root/settings'
import {isSuperAdmin, safePushArrItem, safeRemoveArrItem} from 'root/lib/utils'
import redisCli from 'root/lib/redis'
import {UserModel, RoomModel, ModelBase, StaticModelClass, MessageItem, PlayListItem, AdminAction, RoomStatus, RoomTypes, NowPlayingInfo, UserStatus} from 'root/type'
import {NowPlayingStatus} from 'global/common/enums'
import {userRoomInfoMap, roomHeatMap, roomJoinersMap, roomAdminsMap} from 'root/lib/store'

export namespace ModelDescriptors {
    const modelNameSet = new Set<string>()
    const collectedModelUniqueKeys = new Set<string>()
    const collectedModelDynamicKeys = new Set<string>()

    export function modelDecorator (modelName: string) {
        return (constructor) => {
            if (!modelName) {
                throw new Error('modelName不能为空')
            }
            const isBaseModel = modelName === 'base'
            if (!isBaseModel) {
                if (Object.getPrototypeOf(constructor) !== BaseModel) {
                    throw new Error('父类继承错误!')
                }
                if (modelNameSet.has(modelName)) {
                    throw new Error('不能重复注册 model')
                }
            }
            const baseModelObj = isBaseModel ? constructor : BaseModel
            modelNameSet.add(modelName)
            constructor._modelName = modelName
            const uniqueKeys = new Set<string>([...baseModelObj._uniqueKeys, ...collectedModelUniqueKeys])
            constructor._uniqueKeys = uniqueKeys
            const dynamicKeys = new Set<string>([...baseModelObj._dynamicKeys, ...collectedModelDynamicKeys])
            constructor._dynamicKeys = dynamicKeys
            collectedModelDynamicKeys.clear()
            collectedModelUniqueKeys.clear()
        }
    }

    // 唯一声明，建立索引 (仅支持string)
    export function uniqueDecorator (target, propertyName) {
        collectedModelUniqueKeys.add(propertyName)
    }

    export function dynamicDecorator (target, propertyName) {
        collectedModelDynamicKeys.add(propertyName)
    }

    const isModelInstanceObj = (obj) => obj instanceof BaseModel
    const isModelObj = (obj) => obj instanceof BaseModel.constructor

    export function getUniqueKeys (obj: BaseModel) {
        if (isModelInstanceObj(obj)) {
            return Object.getPrototypeOf(obj).constructor._uniqueKeys
        }
        throw new Error('invalid object')
    }

    export function getDynamicKeys (obj: BaseModel) {
        if (isModelInstanceObj(obj)) {
            return Object.getPrototypeOf(obj).constructor._dynamicKeys
        }
        throw new Error('invalid object')
    }

    export function getModelName (obj: BaseModel | typeof BaseModel) {
        if (isModelInstanceObj(obj)) {
            return Object.getPrototypeOf(obj).constructor._modelName
        }
        if (isModelObj(obj)) {
            return (obj as typeof BaseModel)._modelName
        }
        throw new Error('invalid object')
    }

    export function getIndexRedisKey(obj: BaseModel | typeof BaseModel, feildName: string, value: any) {
        if (['object', 'symbol'].includes(typeof value)) {
            throw new Error('invalid value type')
        }
        const modelName = getModelName(obj)
        const redisKey = `musicradio-modelIndex-${modelName}-${feildName}-${value}`
        return redisKey
    }

}

@ModelDescriptors.modelDecorator('base')
export class BaseModel {
    static _modelName: string = 'base';
    static _uniqueKeys: Set<string> = new Set();
    static _dynamicKeys: Set<string> = new Set();
    id: string;
    protected isInit: boolean = true;

    @ModelDescriptors.dynamicDecorator
    private snapshotObj: this = null;

    constructor (obj = {}) {
        Object.assign(this, obj)
    }
    static generateKey (id: string) {
        return `musicradio-modelid:${id}`
    }
    static async find (ids: string[]) {
        ids = ids.map(BaseModel.generateKey)
        const dataArr = (await redisCli.mget(...ids)) || []
        return dataArr.map(str => str && this._fromJson(str) as any)
    }
    static async findOne (id: string) {
        id = BaseModel.generateKey(id)
        const dataStr = await redisCli.get(id)
        return dataStr && this._fromJson(dataStr) as any
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
            map.set(BaseModel.generateKey(item.id), updatedItem._toJson())
            updatedItems.push(updatedItem)
        })
        await redisCli.mset(map)
        return updatedItems
    }
    // 索引查找
    static async findByIndex (feildName: string, value: any) {
        const uniqueKeys = this._uniqueKeys
        if (!uniqueKeys.has(feildName)) {
            throw new Error(`invalid index feildName: ${feildName}`)
        }
        const key = ModelDescriptors.getIndexRedisKey(this, feildName, value)
        const aimId = await redisCli.get(key)
        if (!aimId) {
            return null
        }
        return await this.findOne(aimId)
    }
    private static _fromJson (str: string) {
        const obj = new this(JSON.parse(str))
        obj.snapshotObj = Object.defineProperties({}, Object.getOwnPropertyDescriptors(obj))
        obj.isInit = false
        return obj
    }
    private _patchResolveModifieldFeilds () {
        const uniqueKeys: Set<string> = ModelDescriptors.getUniqueKeys(this)
        const modifiedFeildNames: string[] = []
        const modifiedOldValueKeys: string[] = []
        const modifiedNewValueKeys: string[] = []
        Array.from(uniqueKeys).forEach(feildName => {
            const newValue = this[feildName]
            if (!this.snapshotObj) { // init
                modifiedNewValueKeys.push(ModelDescriptors.getIndexRedisKey(this, feildName, newValue))
                modifiedFeildNames.push(feildName)
                return
            }
            const oldValue = this.snapshotObj[feildName]
            if (oldValue !== newValue) {
                modifiedOldValueKeys.push(ModelDescriptors.getIndexRedisKey(this, feildName, oldValue))
                modifiedNewValueKeys.push(ModelDescriptors.getIndexRedisKey(this, feildName, newValue))
                modifiedFeildNames.push(feildName)
            }
        })
        const changed = !!modifiedNewValueKeys.length
        return {
            validateBeforeSave: async () => {
                if (!changed) {
                    return
                }
                const resArr = await redisCli.mget(...modifiedNewValueKeys)
                resArr.forEach((res, index) => {
                    const hasExisted = !!res
                    if (hasExisted) {
                        const feildName = modifiedFeildNames[index]
                        throw new Error(`字段${feildName}的值不能重复：${this[feildName]}`)
                    }
                })
            },
            updateIndexAfterSave: async () => {
                if (!changed) {
                    return
                }
                const map = new Map()
                modifiedNewValueKeys.forEach(key => map.set(key, this.id))
                await redisCli.mset(map)
                if (modifiedOldValueKeys.length) {
                    await redisCli.del(...modifiedOldValueKeys)
                }
            }
        }
    }
    private _toJson () {
        const dynamicKeys: Set<string> = ModelDescriptors.getDynamicKeys(this)
        return JSON.stringify(this, (key, value) => {
            if (dynamicKeys.has(key)) {
                return undefined
            }
            return value
        })
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
        const indexTool = this._patchResolveModifieldFeilds()
        await indexTool.validateBeforeSave()
        await redisCli.set(BaseModel.generateKey(this.id), this._toJson())
        await indexTool.updateIndexAfterSave()
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

@ModelDescriptors.modelDecorator('user')
class UserModelDef extends BaseModel implements UserModel{
    constructor (obj = {}) {
        super(obj)
        Object.assign(this, obj)
    }
    status: UserStatus = UserStatus.normal;
    get isSuperAdmin () {
        return this.status === UserStatus.superAdmin
    }
    @ModelDescriptors.uniqueDecorator
    name: string;
    createdRoom: string;
    ip: string;
    blockPlayItems: string[] = [];
    get append () {
        return userRoomInfoMap.get(this.id) || {
            nowRoomId: null,
            nowRoomName: '',
            allowComment: true,
            isRoomCreator: false,
            isSuperAdmin: false,
        }
    }
    get allowComment () {
        return this.append.allowComment
    }
    set allowComment (value: boolean) {
        const info = this.append
        info.allowComment = value
        userRoomInfoMap.set(this.id, info)
    }
}

export const User = defineModel<UserModelDef, typeof UserModelDef>(UserModelDef)

@ModelDescriptors.modelDecorator('room')
class RoomModelDef extends BaseModel implements RoomModel{
    constructor (obj = {}) {
        super(obj)
        Object.assign(this, obj)
    }
    creator: string;
    status: RoomStatus = RoomStatus.active;
    isPublic: boolean = true;
    get isHallRoom (): boolean {
        return this.type === RoomTypes.hallRoom
    }
    type: RoomTypes = RoomTypes.personal;
    max: number = -1;
    name: string;
    nowPlayingInfo: NowPlayingInfo;
    get heat (): number {
        return roomHeatMap.get(this.id) || 0
    }
    get joiners (): string[] {
        return roomJoinersMap.get(this.id) || []
    }
    get admins (): string[] {
        return roomAdminsMap.get(this.id) || []
    }
    banUsers: string[] = [];
    blockIps: string[] = [];
    blockUsers: string[] = [];
    messageHistory: MessageItem[] = [];
    playList: PlayListItem[] = [];
    adminActions: AdminAction[] = [];
    vote?: {
        id: string | number;
        musicId: string;
        agreeUids: string[],
        disagreeUids: string[],
    }

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
        this.joiners.forEach(userId => {
            userRoomInfoMap.delete(userId)
        })
        roomHeatMap.delete(this.id)
        roomJoinersMap.delete(this.id)
        return res
    }

    join (user: UserModel) {
        const isAdmin = isSuperAdmin(user)
        if (!isAdmin) {
            if (!this.isHallRoom && this.max !== -1 && this.heat === this.max) {
                throw new Error('房间超员')
            }
            roomHeatMap.set(this.id, this.heat + 1)
        }
        const isRoomCreator = user.id === this.creator
        if (isAdmin || isRoomCreator) {
            roomAdminsMap.set(this.id, safePushArrItem(this.admins, user.id))
        }
        roomJoinersMap.set(this.id, safePushArrItem(this.joiners, user.id))
        userRoomInfoMap.set(user.id, {
            allowComment: isAdmin || isRoomCreator || !this.banUsers.includes(user.id),
            nowRoomId: this.id,
            nowRoomName: this.name,
            isRoomCreator,
            isSuperAdmin: isAdmin
        })
    }

    quit (user: UserModel) {
        const findIndex = this.joiners.indexOf(user.id)
        if (findIndex > -1) {
            roomJoinersMap.set(this.id, safeRemoveArrItem(this.joiners, user.id))            
            !isSuperAdmin(user) && roomHeatMap.set(this.id, this.heat - 1)
            userRoomInfoMap.delete(user.id)
        }
    }
}

export const Room = defineModel<RoomModelDef, typeof RoomModelDef>( RoomModelDef)