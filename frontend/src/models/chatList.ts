import {Reducer} from 'redux'
import {Effect} from 'dva'
import {MessageTypes, MessageItem, DanmuItem, EmojiItem} from '@/typeConfig'


export interface ChatListModelState {
    chatList: MessageItem[];
    danmuList: DanmuItem[];
    danmuMaxShowCount: number;
    emojiList: EmojiItem[];
    hasMoreEmoji: boolean;
    selectedMessageItem: MessageItem
}

export interface ChatListModelType {
    namespace: 'chatList';
    state: ChatListModelState;
    effects: {
        reqChatList: Effect;
        reqEmojiList: Effect;
    };
    reducers: {
        saveData: Reducer<ChatListModelState>;
        addDanmuItem: Reducer<ChatListModelState>;
        refreshDamuList: Reducer<ChatListModelState>;
        selectMessageItem: Reducer<ChatListModelState>;
        clearSelectedMessageItem: Reducer<ChatListModelState>;
    };
}

const ChatListModel: ChatListModelType = {
    namespace: 'chatList',
    state: {
        chatList: [],
        danmuList: [],
        danmuMaxShowCount: 3,
        emojiList: [],
        hasMoreEmoji: true,
        selectedMessageItem: null
    },
    effects: {  
        * reqChatList ({payload}, _) {
        },
        * reqEmojiList ({payload}, _) {
        }
    },
    reducers: {
        saveData: (state, {payload}) => {
            return {
                ...state,
                ...payload
            }
        },
        addDanmuItem: (state, {payload}) => {
            let {danmuList, danmuMaxShowCount} = state
            const {items} = payload
            let lastLevelValue = danmuList.length !== 0 ? danmuList[danmuList.length - 1].levelValue : danmuMaxShowCount - 1 
            items.forEach(item => {
                item.levelValue = ++lastLevelValue
                item.offset = Math.random() * 0.8
            } )
            danmuList = danmuList.concat(items)
            return {
                ...state,
                danmuList
            }
        },
        refreshDamuList: (state, {payload}) => {
            let {danmuList} = state
            danmuList.forEach(d => d.levelValue --)
            if (danmuList[0].levelValue < -1) {
                danmuList.shift()
            } 
            return {
                ...state,
                danmuList: [...danmuList]
            }
        },
        selectMessageItem: (state, {payload}) => {
            const {selectedMessageItem} = payload
            return {
                ...state,
                selectedMessageItem
            }
        },
        clearSelectedMessageItem: (state, _) => {
            return {
                ...state,
                selectedMessageItem: null
            }
        }
    }
}

export default  ChatListModel
