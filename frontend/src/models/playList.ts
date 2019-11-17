import {Reducer} from 'redux'

const playList =  [
    {
        id: 'song1',// 歌曲id
        name: 'song1',// 歌名
        artist: 'string',// 演唱者
        album: 'string',// 专辑
        duration: 323907,// 时长
        from: 'string',// 点歌人
    },
    {
        id: 'song2',// 歌曲id
        name: 'song2',// 歌名
        artist: 'string',// 演唱者
        album: 'string',// 专辑
        duration: 323907,// 时长
        from: 'string',// 点歌人
    },
    {
        id: 'song3',// 歌曲id
        name: 'song3',// 歌名
        artist: 'string',// 演唱者
        album: 'string',// 专辑
        duration: 323907,// 时长
        from: 'string',// 点歌人
    },
]

export interface PlayListModelState {
    playList: PlayListItem[]
}

export interface PlayListModelType {
    namespace: 'playList';
    state: PlayListModelState;
    reducers: {
        moveItem: Reducer<PlayListModelState>;
        deleteItem: Reducer<PlayListModelState>;
        addItem: Reducer<PlayListModelState>
    };
}

export default {
    namespace: 'playList',
    state: {
        playList: playList
    },
    effects: {  

    },
    reducers: {
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
