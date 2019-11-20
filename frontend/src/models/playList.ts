import {Reducer} from 'redux'
import {Effect} from 'dva'
import {PlayListItem} from '@/typeConfig'

export interface NowPlayingInfo {
    name: string;
    artist: string;
    src: string;
    lyric: string;
    pic: string;
    comment: {
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

export interface PlayListModelType {
    namespace: 'playList';
    state: PlayListModelState;
    effects: {
        fetchNowPlaying: Effect
    };
    reducers: {
        moveItem: Reducer<PlayListModelState>;
        deleteItem: Reducer<PlayListModelState>;
        addItem: Reducer<PlayListModelState>;
        saveData: Reducer<PlayListModelState>
    };
}

const PlayListModel: PlayListModelType = {
    namespace: 'playList',
    state: {
        playList: [],
        nowPlaying: null
    },
    effects: {  
        * fetchNowPlaying ({payload}, _) {
            
        },
    },
    reducers: {
        saveData: (state, {payload}) => {
            return {
                ...state,
                ...payload
            }
        },
        moveItem (state, {payload}) {
            const {from, to} = payload
            let {playList} = state
            const item = playList[from]
            playList.splice(to, 0, item)
            playList.splice(from < to ? from : from + 1, 1)
            return {
                ...state,
                playList: [...playList]
            }
        },
        deleteItem (state, {payload}) {
            let {playList} = state
            const {ids} = payload
            playList = playList.filter(item => !ids.includes(item))
            return {
                ...state,
                playList
            }
        },
        addItem (state, {payload}) {
            let {playList} = state
            const {items} = payload
            playList = playList.concat(items)
            return {
                ...state,
                playList
            }
        }
    }
}
export default PlayListModel
