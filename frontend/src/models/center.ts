import {Reducer} from 'redux'
import {Effect, Subscription} from 'dva'

import {RoomItem, searchMediaItem, MediaTypes, UserInfo, MessageItem, MessageTypes, AdminAction, AdminActionTypes, 
    SearchResValue, UserRoomRecord, UserRoomRecordTypes, SearchTreeType} from 'config/type.conf'
import {ScoketStatus, ClientListenSocketEvents, ServerListenSocketEvents} from '@global/common/enums'
import { searchValueFromObjByTree, deduplicateObjArr, CustomAlert, getLocalStorageData } from '@/utils';
import socket from '@/services/socket'
import {checkReqRes} from '@/utils'
import { LocalStorageKeys } from 'config/type.conf';
import { RoomMusicPlayMode, RoomPlayModeInfo } from '@global/common/enums';

interface SearchInfo<T> {
    searchStr: string;
    searchTree: SearchTreeType<T>
}

export interface CenterModelState {
    openDanmu: boolean;
    notifications: {
        timestamp: number;
        content: string;
    }[];
    nowRoomInfo: {
        id: string;
        name: string;
        creator: string;
        max: number;
        heat: number;
        playMode: RoomMusicPlayMode;
        playModeInfo: RoomPlayModeInfo
    };
    isRoomAdmin: boolean;
    isMobile: boolean;
    userInfo: UserInfo;
    nowSocketStatus: ScoketStatus;
    blockPlayItems: string[];
    roomList: RoomItem[];
    hasMoreRoomItem: boolean;
    adminActionList: SearchResValue<AdminAction>[];
    hasMoreActions: boolean;
    adminActionSearchInfo: SearchInfo<AdminAction>;
    onlineUserList: SearchResValue<UserRoomRecord>[];
    hasMoreOnlineUsers: boolean;
    onlineUserSearchInfo: SearchInfo<UserRoomRecord>;
    coordHotDataList: [
        number,
        number,
        number,
        {
            id: string;
            roomId: string;
            content?: string;
            name?: string;
        }[]
    ][];
}

export interface CenterModelType {
    namespace: 'center';
    state: CenterModelState;
    effects: {
        connectSocket: Effect;
        cutUserStatus: Effect;
        createRoom: Effect;
        destroyRoom: Effect;
        joinRoom: Effect;
        loadRoomInitData: Effect;
        reqRecommenedRoom: Effect;
        blockUser: Effect;
        blockIP: Effect;
        banUserComment: Effect;
        revokeAction: Effect;
        getAdminActionList: Effect;
        handleNotification: Effect;
        setNickName: Effect;
        getOnlineUserList: Effect;
        manageRoomAdmin: Effect;
        getRoomGlobalCoordHotData: Effect;
        swtichRoomPlayMode: Effect;
    };
    reducers: {
        saveData: Reducer<CenterModelState>;
        saveRoomList: Reducer<CenterModelState>;
        saveAdminActions: Reducer<CenterModelState>;
        deleteAdminActions: Reducer<CenterModelState>;
        setNowSocketStatus: Reducer<CenterModelState>;
        addNotification: Reducer<CenterModelState>;
        removeNotification: Reducer<CenterModelState>;
        saveOnlineUserList: Reducer<CenterModelState>;
        updateOnlineUserList: Reducer<CenterModelState>;
        saveCoordHotData: Reducer<CenterModelState>;
    };
    subscriptions: {
        [key: string]: Subscription,
    }
}

const insertIntoOnlineUserList = (onlineUserList, item) => {
    let i = onlineUserList.length - 1
    for (; i >= 0; i--) {
        const o = onlineUserList[i]
        if (item.type <= o.type) {
            break
        }
    }
    onlineUserList.splice(i + 1, 0, item)
}

const getOpenDamuValue = () => {
    const v = getLocalStorageData(LocalStorageKeys.openDanmu)
    return typeof v === 'boolean' ? v : true
}

const CenterModel: CenterModelType = {
    namespace: 'center',
    state: {
        openDanmu: getOpenDamuValue(),
        isMobile: false,
        notifications: [],
        nowSocketStatus: ScoketStatus.closed,
        nowRoomInfo: null,
        blockPlayItems: [],
        userInfo: null,
        roomList: [],
        hasMoreRoomItem: true,
        adminActionList: [],
        hasMoreActions: true,
        adminActionSearchInfo: null,
        onlineUserList: [],
        hasMoreOnlineUsers: true,
        onlineUserSearchInfo: null,
        isRoomAdmin: false,
        coordHotDataList: [],
    },
    effects: {  
        * connectSocket ({payload}, {put}) {
            if (socket.client.connected) {
                return
            }
            socket.connect()
            yield put({
                type: 'saveData',
                payload: {
                    nowSocketStatus: ScoketStatus.waitting
                }
            })
        },
        * createRoom ({payload}, {}) {
            const actionId = socket.emit(ServerListenSocketEvents.createRoom, payload)
            const res = yield socket.awaitActionResponse(actionId)
            checkReqRes(res, '创建房间')
            return res
        },
        * destroyRoom ({payload}, {}) {
            const actionId = socket.emit(ServerListenSocketEvents.destroyRoom, payload)
            const res = yield socket.awaitActionResponse(actionId)
            checkReqRes(res, '销毁房间')
            return res
        },
        * cutUserStatus ({payload}, {}) {
            const actionId = socket.emit(ServerListenSocketEvents.cutUserStatus, payload)
            const res = yield socket.awaitActionResponse(actionId)
            checkReqRes(res, '切换角色身份')
            return res
        },
        * joinRoom ({payload}, {put}) {
            if (!socket.client.connected) {
                yield put({
                    type: 'connectSocket'
                })
            }
            const actionId = socket.emit(ServerListenSocketEvents.joinRoom, payload)
            const res = yield socket.awaitActionResponse(actionId)
            checkReqRes(res, '加入房间')
            return res
        },
        * loadRoomInitData ({payload}, {}) {
            socket.emit(ServerListenSocketEvents.getRoomData, payload)
        },
        * swtichRoomPlayMode ({payload}, {put}) {
            const actionId = socket.emit(ServerListenSocketEvents.switchPlayMode, payload)
            const res = yield socket.awaitActionResponse(actionId)
            checkReqRes(res, '切换')
        },
        * reqRecommenedRoom ({payload}, {put}) {
            const actionId = socket.emit(ServerListenSocketEvents.recommendRoom, payload)
            const res = yield socket.awaitActionResponse(actionId)
            if (res.success) {
                yield put({
                    type: 'saveRoomList',
                    payload: {
                        isReplaced: payload.isReplaced,
                        list: res.list,
                        hasMore: res.hasMore,
                    }
                })
            }
        },
        * setNickName ({payload}, {put}) {
            const actionId = socket.emit(ServerListenSocketEvents.setNickName, payload)
            const res = yield socket.awaitActionResponse(actionId)
            checkReqRes(res, '设置昵称')
        },
        * blockUser ({payload}, {}) {
            const actinId = socket.emit(ServerListenSocketEvents.blockUser, payload)
            const res = yield socket.awaitActionResponse(actinId)
            checkReqRes(res, '提交')
        },
        * blockIP ({payload}, {}) {
            const actinId = socket.emit(ServerListenSocketEvents.blockUserIp, payload)
            const res = yield socket.awaitActionResponse(actinId)
            checkReqRes(res, '提交')
        },
        * banUserComment ({payload}, {put}) {
            const actinId = socket.emit(ServerListenSocketEvents.banUserComment, payload)
            const res = yield socket.awaitActionResponse(actinId)
            checkReqRes(res, '提交')
            if (res.success) {
                yield put({
                    type: 'updateOnlineUserList',
                    payload: {
                        list: [res.banUser]
                    }
                })
            }
        },
        * revokeAction ({payload}, {}) {
            const actinId = socket.emit(ServerListenSocketEvents.revokeAction, payload)
            const res = yield socket.awaitActionResponse(actinId)
            checkReqRes(res, '操作')
        },
        * getAdminActionList ({payload}, {put}) {
            const actinId = socket.emit(ServerListenSocketEvents.getRoomAdminActionList, payload)
            const res = yield socket.awaitActionResponse(actinId, 8000)
            if (!res.success) {
                return
            }
            yield put({
                type: 'saveAdminActions',
                payload: {
                    list: res.list,
                    hasMore: res.hasMore,
                    isReplaced: !!payload.searchStr || !payload.lastId,
                    searchStr: res.searchStr,
                    searchTree: res.searchTree,
                }
            })
        },
        * getOnlineUserList ({payload}, {put}) {
            const actinId = socket.emit(ServerListenSocketEvents.getOnlineUserList, payload)
            const res = yield socket.awaitActionResponse(actinId, 8000)
            if (!res.success) {
                return
            }
            yield put({
                type: 'saveOnlineUserList',
                payload: {
                    adminList: res.admins,
                    otherList: res.others,
                    list: res.list,
                    hasMore: res.hasMore,
                    isReplaced: !!payload.searchStr || !payload.lastId,
                    searchStr: res.searchStr,
                    searchTree: res.searchTree,
                }
            })
        },
        * handleNotification ({ payload }, { put, select }) {
            const {isGlobal = false, message = ''} = payload
            const isMobile = yield select(state => {
                return state.center.isMobile
            })
            if (isMobile || isGlobal) {
                yield put({
                    type: 'addNotification',
                    payload: {
                        content: message
                    }
                })
            } else {
                const messageItem: MessageItem = {
                    id: Date.now().toString(),
                    type: MessageTypes.notification,
                    from: '系统消息',
                    content: {
                        text: message
                    },
                    time: Date.now(),
                }
                yield put({
                    type: 'chatList/updateChatList',
                    payload: {
                        chatList: [messageItem]
                    }
                })
            }
        },
        * manageRoomAdmin ({ payload }, { put, select }) {
            const actinId = socket.emit(ServerListenSocketEvents.manageRoomAdmin, payload)
            const res = yield socket.awaitActionResponse(actinId, 6000)
            checkReqRes(res, '设置')
            if (res.success) {
                yield put({
                    type: 'updateOnlineUserList',
                    payload: {
                        list: [res.admin]
                    }
                })
            }
        },
        * getRoomGlobalCoordHotData ({ payload }, { put, select }) {
            const actinId = socket.emit(ServerListenSocketEvents.getRoomCoordHotData, payload)
            const res = yield socket.awaitActionResponse(actinId, 6000)
            if (res.success) {
                yield put({
                    type: 'saveCoordHotData',
                    payload: {
                        data: res.data || []
                    }
                })
            }
        }   
    },
    reducers: {
        saveData: (state, {payload}) => {
            return {
                ...state,
                ...payload
            }
        },
        saveCoordHotData: (state, {payload}) => {
            const {data = []} = payload
            const coordHotDataList = data.map(obj => {
                const {lat, lon, heat, musicList, messages} = obj
                return [
                    lon,
                    lat,
                    heat,
                    musicList.concat(messages)
                ]
            })
            return {
                ...state,
               coordHotDataList,
            }
        },
        saveRoomList: (state, {payload}) => {
            const {list, isReplaced, hasMore} = payload
            const {roomList} = state
            return {
                ...state,
                hasMoreRoomItem: hasMore,
                roomList: isReplaced ? list : roomList.concat(list)
            }
        },
        saveAdminActions: (state, {payload}) => {
            const {adminActionList: prevList = [], adminActionSearchInfo} = state
            const {list: newList, isReplaced = false, appendBefore = false, hasMore = true, searchTree, searchStr = ''} = payload
            const isSearchMode = !!adminActionSearchInfo
            if (isSearchMode && !isReplaced) {
                return state
            }
            if (searchTree && searchStr) {
                searchValueFromObjByTree(newList, searchTree, searchStr)
            }
            const returnList = isReplaced ? newList : deduplicateObjArr(
                appendBefore ? newList.concat(prevList) : prevList.concat(newList),
                (item) => item.id)
            return {
                ...state,
                adminActionSearchInfo: (searchStr && searchTree) ? {
                    searchStr,
                    searchTree
                } : null,
                hasMoreActions: hasMore,
                adminActionList: returnList ,
            }
        },
        deleteAdminActions: (state, {payload}) => {
            const {adminActionList, adminActionSearchInfo} = state
            const isSearchMode = !!adminActionSearchInfo
            if (isSearchMode) {
                return state
            }
            const {ids = []} = payload
            return {
                ...state,
                adminActionList: adminActionList.filter(item => !ids.includes(item.id))
            }
        },
        saveOnlineUserList: (state, {payload}) => {
            const {onlineUserSearchInfo, onlineUserList} = state
            const {isReplaced = false, hasMore = true, searchTree, searchStr = '', list = []} = payload
            const isSearchMode = !!onlineUserSearchInfo
            if (isSearchMode && !isReplaced) {
                return state
            }
            const newList = isReplaced ? [] : onlineUserList
            list.forEach(insertIntoOnlineUserList.bind(null, newList))
            if (searchTree && searchStr) {
                searchValueFromObjByTree(list, searchTree, searchStr)
            }
            return {
                ...state,
                onlineUserList: deduplicateObjArr(newList, (item) => item.userId),
                onlineUserSearchInfo: (searchStr && searchTree) ? {
                    searchStr,
                    searchTree
                } : null,
                hasMoreOnlineUsers: hasMore,
            }
        },
        updateOnlineUserList: (state, {payload}) => {
            const {onlineUserSearchInfo, onlineUserList} = state
            const {list} = payload
            const isSearchMode = !!onlineUserSearchInfo
            if (isSearchMode) {
                return state
            }
            list.forEach(newItem => {
                const findIndex = onlineUserList.findIndex(o => o.userId === newItem.userId)
                if (findIndex > -1) {
                    const oldItem = onlineUserList[findIndex]
                    if (oldItem.type !== newItem.type) {
                        onlineUserList.splice(findIndex, 1)
                        insertIntoOnlineUserList(onlineUserList, newItem)
                    } else {
                        onlineUserList[findIndex] = newItem
                    }
                } else {
                    insertIntoOnlineUserList(onlineUserList, newItem)
                }
            })
            return {
                ...state,
                onlineUserList: [...onlineUserList],
            }
        },
 
        setNowSocketStatus: (state, {payload: {status: newStatus}}) => {
            const {nowSocketStatus: oldStatus} = state
            let newState = state
            if (newStatus !== oldStatus) {
                if ([ScoketStatus.closed, ScoketStatus.globalBlocked].includes(newStatus)) {
                    socket.client.close()
                }
                if (newStatus === ScoketStatus.closed) {
                    Object.assign(newState, {
                        userInfo: null
                    })
                }
                newState = {
                    ...newState,
                    nowSocketStatus: newStatus
                }
            }
            return newState
        },
        addNotification: (state, {payload: {content}}) => {
            const {notifications} = state
            notifications.push({
                content,
                timestamp: Date.now()
            })
            return {
                ...state,
                notifications: [...notifications]
            }
        },
        removeNotification: (state, {payload: {timestamp}}) => {
            const {notifications} = state
            const findIndex = notifications.findIndex(item => item.timestamp === timestamp)
            if (findIndex > -1) {
                notifications.splice(findIndex, 1)
            }
            return {
                ...state,
                notifications: [...notifications]
            }
        },
    },
    subscriptions: {
        listenSocket: (api) => {
            socket.on(ClientListenSocketEvents.reconnecting, (reason) => {
                api.dispatch({
                    type: 'setNowSocketStatus',
                    payload: {
                        status: ScoketStatus.reconnecting
                    }
                })
            })
            socket.on(ClientListenSocketEvents.updateSocketStatus, (status: ScoketStatus) => {
                api.dispatch({
                    type: 'setNowSocketStatus',
                    payload: {
                        status
                    }
                })
            })
            socket.on(ClientListenSocketEvents.updateRoomInfo, (roomInfo) => {
                api.dispatch({
                    type: 'saveData',
                    payload: {
                        nowRoomInfo: {
                            ...roomInfo,
                            playMode: roomInfo.playModeInfo.mode,
                        }
                    }
                })
            })
            socket.on(ClientListenSocketEvents.updateUserInfo, (userInfo) => {
                const {blockPlayItems, isSuperAdmin} = userInfo
                socket.setIsSuperAdmin(isSuperAdmin)
                api.dispatch({
                    type: 'saveData',
                    payload: {
                        blockPlayItems: blockPlayItems,
                        userInfo: userInfo,
                        isRoomAdmin: !!userInfo && userInfo.userRoomRecordType > UserRoomRecordTypes.others
                    }
                })
            })
            socket.on(ClientListenSocketEvents.notification, (data) => {
                api.dispatch({
                    type: 'handleNotification',
                    payload: data
                })
            })
            socket.on(ClientListenSocketEvents.addAdminActions, (actions: AdminAction[]) => {
                api.dispatch({
                    type: 'saveAdminActions',
                    payload: {
                        list: actions,
                        appendBefore: true,
                    }
                })
            })
            socket.on(ClientListenSocketEvents.deleteAdminActions, (ids: string[]) => {
                api.dispatch({
                    type: 'deleteAdminActions',
                    payload: {
                        ids
                    }
                })
            })
            socket.on(ClientListenSocketEvents.updateOnlineUsers, (list) => {
                api.dispatch({
                    type: 'updateOnlineUserList',
                    payload: {
                        list,
                    }
                })
            })
        },
    }
}

export default  CenterModel
