import {Reducer} from 'redux'
import {Effect} from 'dva'
import {RoomItem, SearchMusicItem, MediaTypes} from '@/typeConfig'

export interface CenterModelState {
    roomList: RoomItem[];
    searchMusicList: {
        type: MediaTypes;
        list: SearchMusicItem[];
    }[];
    searchMediaDetail: {
        type: MediaTypes;
        name: string;
        desc: string;
        pic: string;
        list: SearchMusicItem[]
    }
}

export interface CenterModelType {
    namespace: 'center';
    state: CenterModelState;
    effects: {
        searchMusic: Effect;
        addMusicToPlayList: Effect;
        reqMediaDetail: Effect;
        createRoom: Effect;
        blockUser: Effect;
    };
    reducers: {
        saveData: Reducer<CenterModelState>;
    };
}

const CenterModel: CenterModelType = {
    namespace: 'center',
    state: {
        roomList: [],
        searchMusicList: [],
        searchMediaDetail: null,
    },
    effects: {  
        * searchMusic ({payload}, {}) {

        },
        * addMusicToPlayList ({payload}, {}) {
            
        },
        * reqMediaDetail ({payload}, {}) {

        },
        * createRoom ({payload}, {}) {

        },
        * blockUser ({payload}, {}) {
            
        },
    },
    reducers: {
        saveData: (state, {payload}) => {
            return {
                ...state,
                ...payload
            }
        },
    }
}

export default  CenterModel
