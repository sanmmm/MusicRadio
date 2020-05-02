import uuid from 'uuid/v4'
import crypto from 'crypto'

import { isSuperAdmin, safePushArrItem, safeRemoveArrItem, useBlock } from 'root/lib/utils';
import redisCli from 'root/lib/redis'
import {ModelBase, UserModel, RoomModel, StaticModelClass, MessageItem, PlayListItem, AdminAction, RoomStatus, RoomTypes, 
    NowPlayingInfo, UserStatus, UserRoomRecordTypes, UserRoomRecord} from 'root/type'
import {userRoomInfoMap, roomHeatMap, roomJoinersMap, roomAdminsMap, roomNormalJoinersMap, roomUpdatedUserRecordsMap, modelMemberIdsMap, 
    redisSetCache, isRedisSetCahceLoaded, redisSetToArrayCache} from 'root/lib/store'
import bitSymbols from 'root/config/bitSybmols.json'
import globalConfigs from 'global/common/config';
import settings from 'root/settings';
import { RoomMusicPlayMode } from 'global/common/enums';

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
                if (Object.getPrototypeOf(constructor) !== BaseModelDef) {
                    throw new Error('父类继承错误!')
                }
                if (modelNameSet.has(modelName)) {
                    throw new Error('不能重复注册 model')
                }
            }
            const baseModelObj = isBaseModel ? constructor : BaseModelDef
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

    const isModelInstanceObj = (obj) => obj instanceof BaseModelDef
    const isModelObj = (obj) => obj instanceof BaseModelDef.constructor

    export function getUniqueKeys (obj: BaseModelDef) {
        if (isModelInstanceObj(obj)) {
            return Object.getPrototypeOf(obj).constructor._uniqueKeys
        }
        throw new Error('invalid object')
    }

    export function getDynamicKeys (obj: BaseModelDef) {
        if (isModelInstanceObj(obj)) {
            return Object.getPrototypeOf(obj).constructor._dynamicKeys
        }
        throw new Error('invalid object')
    }

    export function getModelName (obj: BaseModelDef | typeof BaseModelDef) {
        if (isModelInstanceObj(obj)) {
            return Object.getPrototypeOf(obj).constructor._modelName
        }
        if (isModelObj(obj)) {
            return (obj as typeof BaseModelDef)._modelName
        }
        throw new Error('invalid object')
    }

    export function getIndexRedisKey(obj: BaseModelDef | typeof BaseModelDef, feildName: string, value: any) {
        if (['object', 'symbol'].includes(typeof value)) {
            throw new Error('invalid value type')
        }
        const modelName = getModelName(obj)
        const redisKey = `musicradio-modelIndex-${modelName}-${feildName}-${value}`
        return redisKey
    }

    const markPropertyName = '__model_updated'
    function isNeedSetProxy (target, p) {
        const originValue = target[p]
        const descriptor = Object.getOwnPropertyDescriptor(target, p)
        const needSetProxy = target.hasOwnProperty(p) && descriptor && (originValue instanceof Array) && (descriptor.writable || !!descriptor.set)
        return needSetProxy
    }

    export function clearModelPropertyValueUpdatedMark (value: any) {
        if (hasModelPropertyValueUpdatedMark(value)) {
            value[markPropertyName] = false
        }
        return value
    }

    export function hasModelPropertyValueUpdatedMark (value) {
        return value instanceof Object && value[markPropertyName]
    }

    const proxyHandler: ProxyHandler<BaseModelDef> = {
        get (target, p) {
            const originValue = target[p]
            const needSetProxy = isNeedSetProxy(target, p)
      
            let value = originValue
            if (!needSetProxy) {
                return value
            }
            if (originValue instanceof Array) {
                const actions = ['copyWithin', 'splice', 'sort', 'pop', 'shift', 'push', 'unshift', 'reverse', 'fill']
                value = new Proxy(originValue, {
                    get (arrObj, p) {
                        let value = arrObj[p]
                        if (value instanceof Function && actions.includes(p as string)) {
                            return (...args) => {
                                (arrObj as any)[markPropertyName] = true
                                value.call(arrObj, ...args)
                            }
                        }
                        return value
                    }
                })
            }
            return value
        },
        set (target, p: string, value, ...args) {
            if (hasModelPropertyValueUpdatedMark(value)) {
                if (Array.isArray(value)) {
                    value = [...value];
                }
                value[markPropertyName] = false
            }
            const dynamicKeys = ModelDescriptors.getDynamicKeys(target)
            if (!dynamicKeys.has(p)) {
                target._modifiedProperties.add(p)
            }
            Reflect.set(target, p, value)
            return true
        }
    }
    export function useInstanceProxy (obj: BaseModelDef) {
        return new Proxy(obj, proxyHandler)
    }

    export function useModelProxy (model: StaticModelClass<BaseModelDef>) {
        return new Proxy(model, {
            construct (model, args) {
                const instance = new model(...args)
                return useInstanceProxy(instance)
            },
            get (target, p) {
                let v = Reflect.get(target, p)
                if (v instanceof Function) {
                    v = v.bind(target)
                }
                return v
            },
        })
    }
}

namespace UtilFuncs {

    export async function addToRedisSet (key: string, value: string) {
        await redisCli.sadd(key, value)
        const isLoaded = isRedisSetCahceLoaded.get(key)
        if (!isLoaded) {
            await loadRedisSetCache(key)
        }
        const setCache = redisSetCache.get(key), setCacheList = redisSetToArrayCache.get(key)
        if (!setCache.has(value)) {
            setCache.add(value)
            setCacheList.push(value)
        }
    }

    export async function removeItemFromRedisSet (key: string, value: string) {
        await redisCli.srem(key, value)
        const isLoaded = isRedisSetCahceLoaded.get(key)
        if (!isLoaded) {
            await loadRedisSetCache(key)
        }
        const setCache = redisSetCache.get(key), setCacheList = redisSetToArrayCache.get(key)
        if (setCache.has(value)) {
            const findIndex = setCacheList.findIndex(item => item === value)
            if (findIndex > -1) {
                setCacheList.splice(findIndex, 1)
            }
            setCache.delete(value)
        }
    }

    export async function getAllItemsOfRedisSet (key: string) {
        const isLoaded = isRedisSetCahceLoaded.get(key)
        if (!isLoaded) {
            await loadRedisSetCache(key)
        }
        const setList = redisSetToArrayCache.get(key)
        return setList
    }

    export async function loadRedisSetCache (key: string) {
        const isLoaded = isRedisSetCahceLoaded.get(key)
        if (isLoaded) {
            return
        }
        const set = new Set<string>(), setList = []
        let cursor = 0
        do {
            const [nextCursor, items] = await redisCli.sscan(key, cursor, 'count', 1000)
            items.forEach(item => {
                set.add(item)
                setList.push(item)
            })
            cursor = Number(nextCursor)
        } while (!isNaN(cursor) && cursor !== 0)
        redisSetCache.set(key, set)
        redisSetToArrayCache.set(key, setList)
        isRedisSetCahceLoaded.set(key, true)
        console.log(`load redis key:${key} cache end --------------------`)
    }

    export function getModelMemberIdsRedisKey (modelName: string) {
        return `musicradio-model-${modelName}-allMembers`
    }

    export function getPublicRoomIdsRedisKey () {
        return `musicradio-model-room-publicMembers`
    }

    const digit = bitSymbols.length
    const base = Math.pow(digit, 3)

    export function decimalToCustomSystemValue (num: number) {
        const bitArr = []
        let i = num + base
        while (i !== 0) {
            bitArr.unshift(bitSymbols[i % digit])
            i = Math.floor(i / digit)
        }
        return bitArr.join('')
    }

    export function customSystemValueToDecimal (value: string) {
        const number = value.split('').reverse().reduce((num, bitSymbol, i) => {
            const v = bitSymbols.indexOf(bitSymbol)
            return num + v * Math.pow(digit, i)    
        }, 0)
        return number - base
    }

    export function generateRoomPassword (length = 4) {
        return Math.random().toString(32).slice(2, 2 + length)
    }

    export function setObjectValueCrossProxy (obj, propertyName: string, value: any, descriptor?: Partial<PropertyDescriptor>) {
        Object.defineProperty(obj, propertyName, {
            value,
            configurable: true,
            enumerable: true,
            writable: true,
            ...(descriptor || {})
        })
    }
}

@ModelDescriptors.modelDecorator('base')
export class BaseModelDef implements ModelBase {
    static _modelName: string = 'base';
    static _uniqueKeys: Set<string> = new Set();
    static _dynamicKeys: Set<string> = new Set();
    id: string;
    createAt: string; // 创建时间
    @ModelDescriptors.dynamicDecorator
    _modifiedProperties = new Set<string>();
    propertiesStamp: {[key: string]: number} = {};

    @ModelDescriptors.uniqueDecorator
    protected numberId: number
    protected isInit: boolean = true;

    constructor (obj = {}) {
        Object.assign(this, obj)
    }
    static generateKey (id: string) {
        return `musicradio-modelid:${id}`
    }
    static async find (ids: string[]) {
        if (ids.length === 0 ) {
            return []
        }
        ids = ids.map(BaseModelDef.generateKey)
        const dataArr = (await redisCli.mget(...ids)) || []
        return dataArr.map(str => str && this._fromJson(str) as any)
    }
    static async findOne (id: string, isPurely = false) {
        const key = BaseModelDef.generateKey(id)
        const dataStr = await redisCli.get(key)
        return dataStr && this._fromJson(dataStr, isPurely) as any
    }
    static async delete (ids: string[]) {
        ids = ids.map(BaseModelDef.generateKey)
        await redisCli.del(...ids)
    }
    static async update (ids: string[], cb) {
        ids = ids.map(BaseModelDef.generateKey)
        const dataArr = await BaseModelDef.find(ids)
        const map = new Map<string, string>()
        const updatedItems = []
        dataArr.forEach((item) => {
            const updatedItem = cb(item)
            map.set(BaseModelDef.generateKey(item.id), updatedItem._toJson())
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

    static async findAll<U extends boolean> (onlyId?: U) {
        const modelName = ModelDescriptors.getModelName(this)
        const key = UtilFuncs.getModelMemberIdsRedisKey(modelName)
        const ids = await UtilFuncs.getAllItemsOfRedisSet(key)
        return (onlyId ? ids : this.find(ids)) as U extends true ? string[] : any[]
    }

    static async loadAllMembers () {
        console.log(`初始化加载${ModelDescriptors.getModelName(this)}的member id列表到内存中`)
        const modelName = ModelDescriptors.getModelName(this)
        const redisKey = UtilFuncs.getModelMemberIdsRedisKey(modelName)
        await UtilFuncs.loadRedisSetCache(redisKey)
    }

    updateProperty (propertyName: keyof this) {
        const dynamicKeys: Set<any> = ModelDescriptors.getDynamicKeys(this)
        const v = Reflect.get(this, propertyName)
        if (v instanceof Function) {
            throw new Error('not supoort method properties')
        }
        if (!dynamicKeys.has(propertyName)) {
            this._modifiedProperties.add(propertyName as string)
        }
        return this
    }

    private static _fromJson (str: string, isPurely = false) {
        const obj = new this(JSON.parse(str))
        obj.isInit = false
        return isPurely ? obj : ModelDescriptors.useInstanceProxy(obj)
    }

    private _updateModifiedProperties () {
        const dynamicKeys: Set<string> = ModelDescriptors.getDynamicKeys(this)
        Object.getOwnPropertyNames(this).forEach(property => {
            if (dynamicKeys.has(property)) {
                return
            }
            const value = this[property]
            if (ModelDescriptors.hasModelPropertyValueUpdatedMark(value)) {
                ModelDescriptors.clearModelPropertyValueUpdatedMark(value)
                this._modifiedProperties.add(property)
            } 
        })
    }

    private _patchResolveModifieldFeilds (prevObj: this) {
        const isInitial = !prevObj
        const uniqueKeys: string[] = Array.from(ModelDescriptors.getUniqueKeys(this))
        const toResolvedFeildNames: string[] = isInitial ? uniqueKeys : uniqueKeys.filter(key => this._modifiedProperties.has(key))
        const modifiedOldValueKeys: Map<string, string> = new Map()
        const modifiedNewValueKeys: Map<string, string> = new Map()
        toResolvedFeildNames.forEach(feildName => {
            const newValue = this[feildName]
            if (!isInitial) {
                const oldValue = prevObj[feildName]
                if (oldValue !== undefined) {
                    modifiedOldValueKeys.set(ModelDescriptors.getIndexRedisKey(this, feildName, oldValue), feildName)
                }
            }
            if (newValue !== undefined) {
                modifiedNewValueKeys.set(ModelDescriptors.getIndexRedisKey(this, feildName, newValue), feildName)
            }
        })
 
        return {
            validateBeforeSave: async () => {
                if (!modifiedNewValueKeys.size) {
                    return
                }
                const resArr = await redisCli.mget(...modifiedNewValueKeys.keys())
                const feildNames = [...modifiedNewValueKeys.values()]
                resArr.forEach((res, index) => {
                    const hasExisted = !!res
                    if (hasExisted) {
                        const feildName = feildNames[index]
                        throw new Error(`字段${feildName}的值不能重复：${this[feildName]}`)
                    }
                })
            },
            updateIndexAfterSave: async () => {
                if (!modifiedOldValueKeys.size && !modifiedNewValueKeys.size) {
                    return
                }
                const map = new Map()
                modifiedNewValueKeys.forEach((_, key) => map.set(key, this.id))
                await redisCli.mset(map)
                if (modifiedOldValueKeys.size) {
                    await redisCli.del(...modifiedOldValueKeys.keys())
                }
            }
        }
    }

    private _mergeFromLatestObj (latestObj: this) {
        if (!latestObj) { // init
            return
        }
        this._updateModifiedProperties()
        Array.from(this._modifiedProperties).forEach(propertyName => {
            latestObj[propertyName] = this[propertyName]
        })
        Object.assign(this, latestObj)
        return this
    }

    private _updatePropertiesStamp (prevObj: this, modifiedProperties: this['_modifiedProperties']) {
        const isInitial = !prevObj
        const prevStampObj = prevObj && prevObj.propertiesStamp
        const obj = Object.getOwnPropertyNames(this).reduce((stampObj, property) => {
            if (isInitial) {
                stampObj[property] = 0
            } else if (modifiedProperties.has(property)) {
                stampObj[property] ++
            }
            return stampObj
        }, prevStampObj || {})
        UtilFuncs.setObjectValueCrossProxy(this, 'propertiesStamp', obj)
        return obj
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

    getNumberId () {
        return this.numberId
    }

    async save () {
        if (!this.id) {
            this.id = uuid().replace(/-/g, '')
        }
        const modelName = ModelDescriptors.getModelName(this)
        let time = Date.now()
        const isInitial = this.isInit
        this._updateModifiedProperties()
        await useBlock(`modelsave:${modelName}:${this.id}`, {
            wait: true,
            success: async () => {
                let latestObj: this = null
                if (isInitial) {
                    const hasExisted = await redisCli.exists(BaseModelDef.generateKey(this.id))
                    if (hasExisted) {
                        throw new Error(`duplicated id: ${this.id}`)
                    }
                    this.isInit = false
                    this.createAt = new Date().toString()
                    // 生成数字id
                    this.numberId = await redisCli.incr(`musicradio-model-${modelName}-numberIdcursor`)
                } else {
                    const modelDef: typeof BaseModelDef = Object.getPrototypeOf(this).constructor
                    latestObj = await modelDef.findOne(this.id, true)
                }
                const indexTool = this._patchResolveModifieldFeilds(latestObj)
                await indexTool.validateBeforeSave()
                const _modifiedProperties = this._modifiedProperties
                this._mergeFromLatestObj({...latestObj})
                this._updatePropertiesStamp(latestObj, _modifiedProperties)
                this._modifiedProperties.clear()
                await redisCli.set(BaseModelDef.generateKey(this.id), this._toJson())
                await indexTool.updateIndexAfterSave()
            },
        })
        console.log((Date.now() - time) / 1000, modelName, 'save used time-----------------')
        if (isInitial) {
              // 记录id值
              const allIdKey = UtilFuncs.getModelMemberIdsRedisKey(modelName)
              await UtilFuncs.addToRedisSet(allIdKey, this.id)
        }
        return this
    }
    
    async remove () {
        if (!this.id) {
            throw new Error(`invalid id: ${this.id}`)
        }
        await redisCli.del(BaseModelDef.generateKey(this.id))
        const modelName = ModelDescriptors.getModelName(this)
        await UtilFuncs.removeItemFromRedisSet(UtilFuncs.getModelMemberIdsRedisKey(modelName), this.id)
        return this
    }
}

export function defineModel <U, T extends StaticModelClass> (m: T) {
    return ModelDescriptors.useModelProxy(m) as (StaticModelClass<U> & T)
}

@ModelDescriptors.modelDecorator('user')
class UserModelDef extends BaseModelDef implements UserModel{
    constructor (obj = {}) {
        super(obj)
        Object.assign(this, obj)
    }
    static getUserRoomRecords (userIds: string[]) {
        return userIds.map(userId => userRoomInfoMap.get(userId))
    }
    static updateUserRoomRecords (userId, updatedObj: Partial<UserRoomRecord>, isReplaced = false) {
        if (isReplaced) {
            userRoomInfoMap.set(userId, updatedObj as UserRoomRecord)
            return updatedObj as UserRoomRecord
        }
        const record = userRoomInfoMap.get(userId)
        Object.assign(record, updatedObj)
        userRoomInfoMap.set(userId, record)
        return record
    }
    private password: string;
    status: UserStatus = UserStatus.normal;
    get isSuperAdmin () {
        return this.status === UserStatus.superAdmin
    }
    @ModelDescriptors.uniqueDecorator
    name: string;
    createdRoom: string;
    managedRoom: string;
    ip: string;
    blockPlayItems: string[] = [];
    get append () {
        return userRoomInfoMap.get(this.id) || {
            type: UserRoomRecordTypes.others,
            userId: this.id,
            userName:'',
            nowRoomId: null,
            nowRoomName: '',
            nowRoomToken: '',
            nowRoomPassword: '',
            allowComment: true,
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

    private generatePasswordHash (passwordStr: string) {
        const hash = crypto.createHash('sha256')
        hash.update(settings.hashSalt + passwordStr)
        return hash.digest('hex')
    }

    comparePassword (passwordStr: string) {
        return this.password === this.generatePasswordHash(passwordStr)
    }

    setPassword (passwordStr: string) {
        this.password = this.generatePasswordHash(passwordStr)
    }
}

export const User = defineModel<UserModelDef, typeof UserModelDef>(UserModelDef)

@ModelDescriptors.modelDecorator('room')
class RoomModelDef extends BaseModelDef implements RoomModel{
    constructor (obj = {}) {
        super(obj)
        Object.assign(this, obj)
    }
    
    creator: string;
    status: RoomStatus = RoomStatus.active;
    isPublic: boolean = true;
    private password: string;
    get isHallRoom (): boolean {
        return this.type === RoomTypes.hallRoom
    }
    type: RoomTypes = RoomTypes.personal;
    max: number = -1; // -1 表示房间不限人数
    
    get token () {
        if (!this.numberId) {
            throw new Error('numberId 尚未生成')
        }
        if (this.isHallRoom) {
            return globalConfigs.hallRoomToken
        }
        return UtilFuncs.decimalToCustomSystemValue(this.numberId)
    }

    @ModelDescriptors.uniqueDecorator
    name: string;
    
    nowPlayingInfo: NowPlayingInfo;
    get playMode(): RoomMusicPlayMode {
        return this.playModeInfo.mode
    }
    playModeInfo = {
        mode: RoomMusicPlayMode.demand,
    }
    get heat (): number {
        return roomHeatMap.get(this.id) || (
            this.type === RoomTypes.personal ? 1 : 0
        )
    }
    get joiners (): string[] {
        return roomJoinersMap.get(this.id) || []
    }
    get normalJoiners () {
        return roomNormalJoinersMap.get(this.id) || []
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

    static async findRoomByToken (token: string) {
        if (token === globalConfigs.hallRoomToken) {
            return await this.findOne(globalConfigs.hallRoomId) as RoomModelDef
        }
        const numberId = UtilFuncs.customSystemValueToDecimal(token)
        const room = await this.findByIndex('numberId', numberId)
        return room as RoomModelDef
    }

    static getRoomUpdatedUserRecords (roomId) {
        let map = roomUpdatedUserRecordsMap.get(roomId)
        if (!map) {
            map = new Map()
            roomUpdatedUserRecordsMap.set(roomId, map)
        }
        return map
    }

    static clearRoomUpdatedUserRecords (roomId) {
        roomUpdatedUserRecordsMap.get(roomId).clear()
    }

    static async getPublicRooms (onlyId = false) {
        const ids = await UtilFuncs.getAllItemsOfRedisSet(UtilFuncs.getPublicRoomIdsRedisKey())
        if (onlyId) {
            return ids
        } else {
            return this.find(ids)
        }
    }

    async save () {
        let isInit = this.isInit
        if (isInit && !this.isPublic && !this.password) {
            this.password = UtilFuncs.generateRoomPassword()
        }
        const res = await super.save()
        if (isInit && this.isPublic) {
            // 记录对外开放的房间id
            await UtilFuncs.addToRedisSet(UtilFuncs.getPublicRoomIdsRedisKey(), this.id)
        }
        return res
    }

    async remove () {
        const res = await super.remove()
        if (this.isPublic) {
            await UtilFuncs.removeItemFromRedisSet(UtilFuncs.getPublicRoomIdsRedisKey(), this.id)
        }
        this.joiners.forEach(userId => {
            userRoomInfoMap.delete(userId)
        })
        roomHeatMap.delete(this.id)
        roomJoinersMap.delete(this.id)
        roomNormalJoinersMap.delete(this.id)
        roomAdminsMap.delete(this.id)
        roomUpdatedUserRecordsMap.delete(this.id)
        return res
    }

    join (user: UserModel) {
        const isSuper = isSuperAdmin(user)
        const isRoomCreator = !isSuper && this.creator === user.id
        const isAdmin = isSuper || isRoomCreator
        if (!isAdmin) {
            if (!this.isHallRoom && this.max !== -1 && this.heat === this.max) {
                throw new Error('房间超员')
            }
            roomHeatMap.set(this.id, this.heat + 1)
        }
        roomJoinersMap.set(this.id, safePushArrItem(this.joiners, user.id))
        if (isAdmin) {
            roomAdminsMap.set(this.id, safePushArrItem(this.admins, user.id))
        } else {
            roomNormalJoinersMap.set(this.id, safePushArrItem(this.normalJoiners, user.id))
        }
        userRoomInfoMap.set(user.id, {
            userId: user.id,
            userName: user.name,
            allowComment: isSuper || isRoomCreator || !this.banUsers.includes(user.id),
            nowRoomId: this.id,
            nowRoomName: this.name,
            nowRoomToken: this.token,
            nowRoomPassword: isAdmin ? this.password : '',
            type: isRoomCreator ? UserRoomRecordTypes.creator : (
                isSuper ? UserRoomRecordTypes.superAdmin : UserRoomRecordTypes.others
            )
        })
        const updatedRecordMap = Room.getRoomUpdatedUserRecords(this.id)
        updatedRecordMap.set(user.id, {
            ...user.append,
        })
    }

    quit (user: UserModel) {
        const isSuper = isSuperAdmin(user)
        const isRoomCreator = !isSuper && this.creator === user.id
        const findIndex = this.joiners.indexOf(user.id)
        if (findIndex > -1) {
            roomJoinersMap.set(this.id, safeRemoveArrItem(this.joiners, user.id))            
            if (user.append.type === UserRoomRecordTypes.others) {
                roomNormalJoinersMap.set(this.id, safeRemoveArrItem(this.normalJoiners, user.id))
            } else {
                roomAdminsMap.set(this.id, safeRemoveArrItem(this.admins, user.id))
            }
            !(isSuper || isRoomCreator) && roomHeatMap.set(this.id, this.heat - 1)
            const userRecord = userRoomInfoMap.get(user.id)
            userRoomInfoMap.delete(user.id)
            const updatedRecordMap = Room.getRoomUpdatedUserRecords(this.id)
            updatedRecordMap.set(user.id, {
                ...userRecord,
                isOffline: true,
            })
        }
    }

    awardAdmin (user: UserModel) {
        const record = User.updateUserRoomRecords(user.id, {
            type: UserRoomRecordTypes.normalAdmin,
            nowRoomPassword: this.password,
        })
        const updatedRecordMap = Room.getRoomUpdatedUserRecords(this.id)
        updatedRecordMap.set(user.id, record)
        roomNormalJoinersMap.set(this.id, safeRemoveArrItem(roomNormalJoinersMap.get(this.id), user.id))
        roomAdminsMap.set(this.id, safePushArrItem(roomAdminsMap.get(this.id), user.id))
    }

    removeAdmin (user: UserModel) {
        const record = User.updateUserRoomRecords(user.id, {
            type: UserRoomRecordTypes.others,
            nowRoomPassword: '',
        })
        const updatedRecordMap = Room.getRoomUpdatedUserRecords(this.id)
        updatedRecordMap.set(user.id, record)
        roomNormalJoinersMap.set(this.id, safePushArrItem(roomNormalJoinersMap.get(this.id), user.id))
        roomAdminsMap.set(this.id, safeRemoveArrItem(roomAdminsMap.get(this.id), user.id))
    }

    getRoomUserRecords () {
        return this.joiners.map(userId => userRoomInfoMap.get(userId))
    }

    isJoinAble (reqUser: UserModel) {
        if (isSuperAdmin(reqUser) || reqUser.id === this.creator) {
            return true
        }
        if (this.blockUsers.includes(reqUser.id) || this.blockIps.includes(reqUser.ip)){
            return false
        }
        const heat = this.heat
        if (this.isHallRoom || this.max === -1 || heat < this.max) {
            return true
        }   
        return false
    }

    validatePassword (password: string) {
        return password === this.password
    }

    getRoomPassword () {
        return this.password
    }

}

export const Room = defineModel<RoomModelDef, typeof RoomModelDef>( RoomModelDef)