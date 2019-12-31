import {Reducer} from 'redux'
import {Effect, Subscription} from 'dva'
import dayjs, {Dayjs} from 'dayjs'

import {MessageTypes, MessageItem, DanmuItem, EmojiItem, MediaTypes, searchMediaItem, ChatListNoticeTypes} from '@/typeConfig'
import {ServerListenSocketEvents, ClientListenSocketEvents} from '@global/common/enums'
import socket from '@/services/socket'

const formatAtSignMessage = (atSignArr: MessageItem['content']['atSign'], text: string) => {
    const obj = {}
    atSignArr.forEach((item) => {
        const {atSignPostion, atSignToUserName} = item
        let preStr = obj[atSignPostion] || ''
        preStr += `@${atSignToUserName} `
        obj[atSignPostion] = preStr
    })
    const positions = Object.keys(obj)
    let str = ''
    positions.forEach((position, index) => {
        const atStr = obj[position]
        if (!atStr) {
            return
        }
        const nextPosition = positions[index + 1]
        str += atStr + text.slice(Number(position), nextPosition && Number(nextPosition))
    })
    return str
}
export interface ChatListModelState {
    messages: MessageItem[][];
    messageItemCount: number;
    unreadMessageIds: string[];
    onScrollToBottom: () => any; // chatlist 组件的方法,当发送消息时触发调用
    unreadAtSignMessage: MessageItem;
    unreadVoteMessage: MessageItem;
    isReading: boolean; // 聊天框滚动条是否在底部
    danmuList: DanmuItem[];
    danmuMaxShowCount: number;
    emojiList: EmojiItem[];
    hasMoreEmoji: boolean;
    inputMessageObj: {
        text?: string;
        atSign?: {  // @功能
            atSignToUserName: string; // @到的人的姓名
            atSignToUserId: string; // @到的人的id
            atSignPostion: number; // @符号在消息内容中的位置
        }[]
    };
    searchMediaList: {
        type: MediaTypes;
        list: searchMediaItem[];
    }[];
    searchMediaDetail: {
        type: MediaTypes;
        name: string;
        desc: string;
        pic: string;
        list: searchMediaItem[]
    }
    selectedMessageItem: MessageItem
}

export interface ChatListModelType {
    namespace: 'chatList';
    state: ChatListModelState;
    effects: {
        sendMessage: Effect;
        reqEmojiList: Effect;
        searchMedia: Effect;
        searchMediaDetail: Effect;
        updateChatList: Effect;
    };
    reducers: {
        saveData: Reducer<ChatListModelState>;
        setEmojiList: Reducer<ChatListModelState>;
        addDanmuItems: Reducer<ChatListModelState>;
        refreshDamuList: Reducer<ChatListModelState>;
        selectMessageItem: Reducer<ChatListModelState>;
        handleAtSignAction: Reducer<ChatListModelState>;
        clearSelectedMessageItem: Reducer<ChatListModelState>;
    };
    subscriptions: {
        [key: string]: Subscription,
    }
}

const ChatListModel: ChatListModelType = {
    namespace: 'chatList',
    state: {
        onScrollToBottom: null,
        unreadAtSignMessage: null,
        unreadVoteMessage: null,
        unreadMessageIds: [],
        isReading: true,
        messageItemCount: 0,
        messages: [],
        danmuList: [],
        danmuMaxShowCount: 3,
        emojiList: [],
        hasMoreEmoji: true,
        inputMessageObj: null,
        selectedMessageItem: null,
        searchMediaList: [],
        searchMediaDetail: null,
    },
    effects: {  
        * sendMessage ({payload}, {put, select}) {
            const actionId = socket.emit(ServerListenSocketEvents.sendMessage, payload)
           
            const {onScrollToBottom} = yield select(state => {
                return {
                    onScrollToBottom: state.chatList.onScrollToBottom
                }
            })
            if (onScrollToBottom) {
                onScrollToBottom()
            }
            yield socket.awaitActionResponse(actionId)
        },
        * reqEmojiList ({payload}, {put,}) {
            const actionId = socket.emit(ServerListenSocketEvents.getEmojiList, payload)
            const res = yield socket.awaitActionResponse(actionId)
            yield put({
                type: 'setEmojiList',
                payload: {
                    hasMoreEmoji: res.hasMore,
                    emojiList: res.list
                }
            })
        },
        * updateChatList ({payload}, {put, select}) {
            const {chatList} = payload
            const {userId, oldMessages, oldMessageItemCount, oldUnreadMessageIds, isReading} = yield select((state) => {
                const {chatList: {messages, messageItemCount, isReading, unreadMessageIds}, 
                    center: {userInfo}} = state
                return {
                    userId: userInfo && userInfo.id,
                    oldMessages: messages,
                    oldUnreadMessageIds: unreadMessageIds,
                    oldMessageItemCount: messageItemCount,
                    isReading,
                }
            }, )
            let newMessages = oldMessages, newMessageItemCount = oldMessageItemCount, unreadAtSignMessage = null
            const newUnreadIds = []
            if (chatList && chatList.length) {
                const appendMessages: MessageItem[][] = []
                let subArr: MessageItem[] = oldMessages.length ? oldMessages.pop() : []
                let lastTime: Dayjs = subArr.length ? dayjs(subArr[subArr.length - 1].time) : null;

                (chatList as MessageItem[]).forEach((m, index) => {
                    const messageDate = dayjs(m.time)
                    if (!lastTime) {
                        lastTime = messageDate
                    }
                    let flag = false
                    if (messageDate.date() !== lastTime.date()) {
                        flag = true
                    } else if (messageDate.isAfter(lastTime.add(3, 'hour'))) {
                        flag = true
                    }

                    if (flag) {
                        appendMessages.push(subArr)
                        subArr = []
                    }
                    subArr.push(m)
                    lastTime = messageDate
                    if (index === chatList.length - 1) {
                        appendMessages.push(subArr)
                    }

                    newMessageItemCount ++
                    if (!isReading && m.type !== MessageTypes.notification && m.fromId !== userId) {
                        newUnreadIds.push(m.id)
                    }       
                    if (m.content) {
                        const {atSign = [], text = ''} = m.content
                        if (atSign.some(i => i.atSignToUserId === userId) && m.fromId !== userId) {
                            m.content.text = formatAtSignMessage(atSign, text)
                            unreadAtSignMessage = m
                        }
                    } 
                })
                newMessages = newMessages.concat(appendMessages)
            }
            const newState: any = {
                messages: newMessages,
                messageItemCount: newMessageItemCount,
            }
            if (newUnreadIds.length) {
                newState.unreadMessageIds = oldUnreadMessageIds.concat(newUnreadIds)
            }
            if (unreadAtSignMessage) {
                newState.unreadAtSignMessage = unreadAtSignMessage
            }
            yield put({
                type: 'saveData',
                payload: newState
            })
        },
        * searchMedia ({payload}, {put,}) {
            const actionId = socket.emit(ServerListenSocketEvents.searchMedia, payload)
            const res = yield socket.awaitActionResponse(actionId)
            yield put({
                type: 'saveData',
                payload: {
                    searchMediaList: res.list
                }
            })
        },
        * searchMediaDetail ({payload}, {put,}) {
            const actionId = socket.emit(ServerListenSocketEvents.getMediaDetail, payload)
            const res = yield socket.awaitActionResponse(actionId)
            yield put({
                type: 'saveData',
                payload: {
                    searchMediaDetail: res.detail
                }
            })
        },
    },
    reducers: {
        saveData: (state, {payload}) => {
            return {
                ...state,
                ...payload
            } 
        },
        setEmojiList: (state, {payload}) => {
            return {
                ...state,
                hasMoreEmoji: payload.hasMoreEmoji,
                emojiList: state.emojiList.concat(payload.emojiList)
            }
        },
        handleAtSignAction: (state, {payload}) => {
            const {atSignToUserId, atSignToUserName} = payload
            const inputMessageObj = state.inputMessageObj || {}
            const {atSign = [], text = ''} = inputMessageObj
            atSign.push({
                atSignToUserId,
                atSignToUserName,
                atSignPostion: text.length - 1,
            })
            return {
                ...state,
                inputMessageObj: {
                    ...inputMessageObj,
                    atSign: [...atSign],
                    text: formatAtSignMessage(atSign, text)
                }
            }
        },
        addDanmuItems: (state, {payload}) => {
            let {danmuList, danmuMaxShowCount} = state
            const {items} = payload
            const nowLastItem = danmuList.slice(-1)[0]
            const defaultLevelValue = danmuMaxShowCount - 1
            let lastLevelValue = (nowLastItem && nowLastItem.levelValue > defaultLevelValue) ? nowLastItem.levelValue : defaultLevelValue
            const newDanmuItems: DanmuItem[] = [] 
            items.forEach((item: MessageItem) => {
                if (item.type !== MessageTypes.notification) {
                    newDanmuItems.push({
                        ...item,
                        levelValue: ++lastLevelValue,
                        offset: Math.random() * 0.8
                    })
                }
            })
            danmuList = danmuList.concat(newDanmuItems)
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
        },
    },
    subscriptions: {
        listenSocket (api) {
            socket.on(ClientListenSocketEvents.addChatListMessages, (messages) => {
                api.dispatch({
                    type: 'updateChatList',
                    payload: {
                        chatList: messages
                    }
                })
                api.dispatch({
                    type: 'addDanmuItems',
                    payload: {
                       items: messages 
                    }
                })
            })
        }
    }
}

export default  ChatListModel
