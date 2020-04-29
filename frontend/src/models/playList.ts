import { Reducer } from 'redux'
import { Effect, Subscription } from 'dva'

import socket from '@/services/socket'
import { ServerListenSocketEvents, ClientListenSocketEvents, NowPlayingStatus } from '@global/common/enums'
import { PlayListItem } from 'config/type.conf'

export interface NowPlayingInfo {
    id: string;
    name: string;
    artist: string;
    src?: string;
    lyric?: string;
    pic?: string;
    duration: number;
    status: NowPlayingStatus;
    endAt: number;
    progress: number;
    timestamp: number; // 后端生成的消息时间戳
    comment?: {
        content: string;
        userId: number;
        avatarUrl: string;
        nickName: string;
    };
}

export interface PlayListModelState {
    playList: PlayListItem[];
    nowPlaying: NowPlayingInfo;
}

const getInitState = () => {
    return {
        playList: [],
        nowPlaying: null
    } as PlayListModelState
}

export interface PlayListModelType {
    namespace: 'playList';
    state: PlayListModelState;
    effects: {
        addMusicToPlayList: Effect;
        movePlayListItem: Effect;
        blockPlayListItems: Effect;
        unblockPlayListItems: Effect;
        deletePlayListItem: Effect;
        pausePlay: Effect;
        startPlay: Effect;
        changePlayingProgress: Effect;
    };
    reducers: {
        updateNowPlayingInfo: Reducer<PlayListModelState>;
        moveItem: Reducer<PlayListModelState>;
        deleteItem: Reducer<PlayListModelState>;
        addItems: Reducer<PlayListModelState>;
        saveData: Reducer<PlayListModelState>;
        initState: Reducer<PlayListModelState>
    };
    subscriptions: {
        listenScoket: Subscription
    }
}

const PlayListModel: PlayListModelType = {
    namespace: 'playList',
    state: {
        playList: [],
        nowPlaying: null
    },
    effects: {
        * addMusicToPlayList({ payload }, _) {
            const actionId = socket.emit(ServerListenSocketEvents.addPlayListItems, payload)
            yield socket.awaitActionResponse(actionId)
        },
        * movePlayListItem ({ payload }, _) {
            const actionId = socket.emit(ServerListenSocketEvents.movePlayListItem, payload)
            yield socket.awaitActionResponse(actionId)
        },
        * blockPlayListItems ({ payload }, _) {
            const actionId = socket.emit(ServerListenSocketEvents.blockPlayListItems, payload)
            const res = yield socket.awaitActionResponse(actionId)
            return res.success
        },
        * unblockPlayListItems ({ payload }, _) {
            const actionId = socket.emit(ServerListenSocketEvents.unblockPlayListItems, payload)
            const res = yield socket.awaitActionResponse(actionId)
            return res.success
        },
        * deletePlayListItem({ payload }, _) {
            const actionId = socket.emit(ServerListenSocketEvents.deletePlayListItems, payload)
            const res = yield socket.awaitActionResponse(actionId)
            return res.success
        },
        * pausePlay ({ payload }, _) {
            const actionId = socket.emit(ServerListenSocketEvents.pausePlaying, payload)
            yield socket.awaitActionResponse(actionId)
        },
        * startPlay({ payload }, _) {
            const actionId = socket.emit(ServerListenSocketEvents.startPlaying, payload)
            yield socket.awaitActionResponse(actionId)
        },
        * changePlayingProgress({ payload }, {put, select}) {
            const actionId = socket.emit(ServerListenSocketEvents.changeProgress, payload)
            yield socket.awaitActionResponse(actionId)
        },
    },
    reducers: {
        saveData: (state, { payload }) => {
            return {
                ...state,
                ...payload
            }
        },
        initState: (state, {payload = {}}) => {
            const {exclude = []} = payload
            const oldValues: Partial<PlayListModelState> = {}
            exclude.forEach(key => {
                oldValues[key] = state[key]
            })
            return Object.assign(getInitState(), oldValues)
        },
        updateNowPlayingInfo: (state, {payload}) => {
            const {nowPlaying: oldData} = state
            const newData: NowPlayingInfo = payload.nowPlaying
            let newState = state
            if (!newData || !oldData || newData.timestamp >= oldData.timestamp) {
                newState = {
                    ...state,
                    nowPlaying: newData
                }
            }
            return newState
        },
        moveItem(state, { payload }) {
            const { from, to } = payload
            let { playList } = state
            const item = playList[from]
            playList.splice(from, 1)
            playList.splice(to, 0, item)
            return {
                ...state,
                playList: [...playList]
            }
        },
        deleteItem(state, { payload }) {
            let { playList } = state
            const { ids } = payload
            playList = playList.filter(item => !ids.includes(item.id))
            return {
                ...state,
                playList
            }
        },
        addItems(state, { payload }) {
            let { playList } = state
            const { items } = payload
            playList = playList.concat(items)
            return {
                ...state,
                playList
            }
        }
    },
    subscriptions: {
        listenScoket: (api) => {
            socket.on(ClientListenSocketEvents.addPlayListItems, (list) => {
                api.dispatch({
                    type: 'addItems',
                    payload: {
                        items: list
                    }
                })
            })
            socket.on(ClientListenSocketEvents.movePlayListItem, ({fromIndex: from, toIndex: to}) => {
                api.dispatch({
                    type: 'moveItem',
                    payload: {
                        from,
                        to
                    }
                })
            })
            socket.on(ClientListenSocketEvents.deletePlayListItems, (ids) => {
                api.dispatch({
                    type: 'deleteItem',
                    payload: {
                        ids
                    }
                })
            })
            socket.on(ClientListenSocketEvents.recieveNowPlayingInfo, (info) => {
                api.dispatch({
                    type: 'updateNowPlayingInfo',
                    payload: {
                        nowPlaying: info
                    }
                })
            })
        }
    }
}
export default PlayListModel
