import {Reducer} from 'redux'
import {Effect} from 'dva'

const playList =  [
    {
        id: 'song1',// 歌曲id
        name: 'song1',// 歌名
        artist: 'string',// 演唱者
        album: 'string',// 专辑
        duration: 323907,// 时长
        isBlock: false,
        from: 'string',// 点歌人
    },
    {
        id: 'song2',// 歌曲id
        name: 'song2',// 歌名
        artist: 'string',// 演唱者
        album: 'string',// 专辑
        duration: 323907,// 时长
        isBlock: false,
        from: 'string',// 点歌人
    },
    {
        id: 'song3',// 歌曲id
        name: 'song3',// 歌名
        artist: 'string',// 演唱者
        album: 'string',// 专辑
        duration: 323907,// 时长
        isBlock: false,
        from: 'string',// 点歌人
    },
]

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
        addItem: Reducer<PlayListModelState>
    };
}

const PlayListModel: PlayListModelType = {
    namespace: 'playList',
    state: {
        playList: playList,
        nowPlaying: {
            pic: 'https://y.gtimg.cn/music/photo_new/T002R300x300M0000024uN121wrWdZ_1.jpg?max_age=2592000'
        }
    },
    effects: {  
        * fetchNowPlaying ({payload}, _) {
            
        },
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
export default PlayListModel
