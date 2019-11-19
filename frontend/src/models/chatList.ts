import {Reducer} from 'redux'

enum MessageTypes {
    notice, // 系统通知
    advanced, // 高级弹幕， 房管，或超级管理员所发
    normal, // 普通消息
    send, // 发送的消息(仅发送者本地可见)
    response, // 系统响应
}
const messages = [
    {
        from: '伯钧大魔王',
        content: '18年好啊',
        time: '2018-02-03',
        type: MessageTypes.normal
    },
    {
        from: '用户2',
        content: '19年号',
        time: '2019-01-01',
        type: MessageTypes.normal
    },
    {
        from: '用户3',
        content: '19年号',
        time: '2019-01-01 01:22:23',
        type: MessageTypes.normal
    },
    {
        from: '管理员',
        tag: '管理员',
        content: '友好讨论',
        time: '2019-01-03',
        type: MessageTypes.advanced
    },
    {
        from: '我是我',
        content: '大家好',
        time: '2019-01-03',
        type: MessageTypes.send
    },
    {
        from: '系统',
        content: '发送失败',
        time: '2019-01-03',
        type: MessageTypes.response
    },
    {
        from: '系统消息',
        content: '123已被系统管理员禁言',
        time: '2019-01-03',
        type: MessageTypes.notice
    },
]

export interface ChatListModelState {
    chatList: MessageItem[];
    danmuList: DanmuItem[];
    danmuMaxShowCount: number;
}

export interface ChatListModelType {
    namespace: 'chatList';
    state: ChatListModelState;
    effects: {

    };
    reducers: {
        saveData: Reducer<ChatListModelState>;
        addDanmuItem: Reducer<ChatListModelState>;
        refreshDamuList: Reducer<ChatListModelState>;
    };
}

const ChatListModel: ChatListModelType = {
    namespace: 'chatList',
    state: {
        chatList: messages,
        danmuList: [],
        danmuMaxShowCount: 3,
    },
    effects: {  
        
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
        }
        
    }
}

export default  ChatListModel
