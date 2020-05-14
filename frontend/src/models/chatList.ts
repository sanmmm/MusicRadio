import { Reducer } from 'redux'
import { Effect, Subscription } from 'dva'
import dayjs, { Dayjs } from 'dayjs'

import { MessageTypes, MessageItem, DanmuItem, EmojiItem, MediaTypes, searchMediaItem, ChatListNoticeTypes } from 'config/type.conf'
import { ServerListenSocketEvents, ClientListenSocketEvents } from '@global/common/enums'
import { CustomAlert, checkReqRes, urlCompatible } from '@/utils';
import socket from '@/services/socket'

const formatAtSignMessage = (atSignArr: MessageItem['content']['atSign'], text: string) => {
    if (!atSignArr || !atSignArr.length) {
        return text
    }
    const obj = {}
    atSignArr.forEach((item) => {
        const { atSignPostion, atSignToUserName } = item
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

const transformVoteActionToMessageItem = (voteAction, isNew = false): MessageItem => {
    if (!voteAction) {
        return null
    }
    const message: MessageItem = {
        id: Date.now().toString(),
        time: Date.now(),
        content: {
            text: isNew ? `对《${voteAction.musicName}》的切歌投票正在进行中, 点击[投票切歌]即可进行投票` :
                `${voteAction.agreeCount}/${voteAction.onlineTotalCount}已投票`
        },
        from: '系统消息',
        fromId: '',
        type: isNew ? MessageTypes.notice : MessageTypes.notification,
    }
    return message
}

const getInitState = () => {
    return {
        onScrollToBottom: null,
        unreadAtSignMessage: null,
        unreadVoteMessage: null,
        unreadMessageIds: [],
        voteAction: null,
        isReading: true,
        messageItemCount: 0,
        messages: [],
        danmuList: [],
        lastReadDanmuItemTime: null,
        emojiList: [],
        hasMoreEmoji: true,
        inputMessageObj: null,
        selectedMessageItem: null,
        searchMediaList: [],
        searchMediaDetail: null,
    } as ChatListModelState
}

export interface ChatListModelState {
    messages: MessageItem[][];
    messageItemCount: number;
    unreadMessageIds: string[];
    onScrollToBottom: () => any; // chatlist 组件的方法,当发送消息时触发调用
    unreadAtSignMessage: MessageItem;
    unreadVoteMessage: MessageItem;
    voteAction: {
        id: string;
        musicId: string;
        voted: boolean;
        disagreeCount: number;
        agreeCount: number;
        onlineTotalCount: number;
    };
    isReading: boolean; // 聊天框滚动条是否在底部
    danmuList: MessageItem[];
    lastReadDanmuItemTime: Date; // 最近已读 弹幕消息的时间节点
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
        voteToCutMusic: Effect;
        reqEmojiList: Effect;
        searchMedia: Effect;
        searchMediaDetail: Effect;
        updateVoteAction: Effect;
        updateChatList: Effect;
        withdrawlMessageItem: Effect;
    };
    reducers: {
        initState: Reducer<ChatListModelState>;
        saveData: Reducer<ChatListModelState>;
        setEmojiList: Reducer<ChatListModelState>;
        addDanmuItems: Reducer<ChatListModelState>;
        selectMessageItem: Reducer<ChatListModelState>;
        handleAtSignAction: Reducer<ChatListModelState>;
        clearSelectedMessageItem: Reducer<ChatListModelState>;
        handleWithdrawlMessageItems: Reducer<ChatListModelState>;
    };
    subscriptions: {
        [key: string]: Subscription,
    }
}

const ChatListModel: ChatListModelType = {
    namespace: 'chatList',
    state: getInitState(),
    effects: {
        * sendMessage({ payload }, { put, select }) {
            const actionId = socket.emit(ServerListenSocketEvents.sendMessage, payload)

            const { onScrollToBottom } = yield select(state => {
                return {
                    onScrollToBottom: state.chatList.onScrollToBottom
                }
            })
            if (onScrollToBottom) {
                onScrollToBottom()
            }
            const res = yield socket.awaitActionResponse(actionId)
            checkReqRes(res, '消息发送')
            return res.success
        },
        * withdrawlMessageItem({ payload }, { put }) {
            const actionId = socket.emit(ServerListenSocketEvents.withdrawlMessage, payload)
        },
        * voteToCutMusic({ payload }, { put, select }) {
            const { voteAction, isSuperAdmin, onScrollToBottom } = yield select((state) => {
                const { chatList: { voteAction, onScrollToBottom }, center: { userInfo } } = state
                return {
                    voteAction,
                    isSuperAdmin: userInfo && userInfo.isSuperAdmin,
                    onScrollToBottom,
                }
            })
            onScrollToBottom && onScrollToBottom()
            let msg = ''
            if (voteAction) {
                if (voteAction.voted) {
                    msg = '您已投票！请不要重复操作'
                }
                if (isSuperAdmin) {
                    msg = '超级管理员无法参与投票'
                }
            }
            if (msg) {
                const message: MessageItem = {
                    id: Date.now().toString(),
                    time: Date.now(),
                    content: {
                        text: msg
                    },
                    from: '系统提醒',
                    fromId: '',
                    type: MessageTypes.notification,
                }
                yield put({
                    type: 'updateChatList',
                    payload: {
                        chatList: [message]
                    }
                })
                return
            }
            const actionId = socket.emit(ServerListenSocketEvents.voteToCutMusic, payload)
            yield socket.awaitActionResponse(actionId)
        },
        * reqEmojiList({ payload }, { put, }) {
            const actionId = socket.emit(ServerListenSocketEvents.getEmojiList, payload)
            const res = yield socket.awaitActionResponse(actionId)
            if (!res.success) {
                return
            }
            yield put({
                type: 'setEmojiList',
                payload: {
                    hasMoreEmoji: res.hasMore,
                    emojiList: res.list.map(item => {
                        item.src = urlCompatible(item.src)
                        return item
                    })
                }
            })
        },
        * updateVoteAction({ payload }, { put, select }) {
            const { voteAction: oldAction, isSuperAdmin }: {
                voteAction: ChatListModelState['voteAction'];
                isSuperAdmin: boolean;
            } = yield select((state) => {
                const { chatList: { voteAction }, center: { userInfo } } = state
                return {
                    voteAction,
                    isSuperAdmin: userInfo && userInfo.isSuperAdmin,
                }
            })
            const obj: Partial<ChatListModelState> = {}
            const { voteAction: newAction } = payload
            if (newAction && oldAction && newAction.id === oldAction.id) {
                const messageItem: MessageItem = transformVoteActionToMessageItem(newAction, false)
                yield put({
                    type: 'updateChatList',
                    payload: {
                        chatList: [messageItem]
                    }
                })
            } else if (!isSuperAdmin) {
                const messageItem: MessageItem = transformVoteActionToMessageItem(newAction, true)
                obj.unreadVoteMessage = messageItem
                // add message to chatlist
                if (messageItem) {
                    yield put({
                        type: 'updateChatList',
                        payload: {
                            chatList: [messageItem]
                        }
                    })
                }
            }
            obj.voteAction = newAction
            yield put({
                type: 'saveData',
                payload: obj
            })
        },
        * updateChatList({ payload }, { put, select }) {
            const { chatList } = payload
            const { userId, oldMessages, oldMessageItemCount, oldUnreadMessageIds, isReading, lastReadMessageTime } = yield select((state) => {
                const { chatList: { messages, messageItemCount, isReading, unreadMessageIds },
                    center: { userInfo } } = state
                return {
                    userId: userInfo && userInfo.id,
                    lastReadMessageTime: userInfo && userInfo.lastReadMessageTime,
                    oldMessages: messages,
                    oldUnreadMessageIds: unreadMessageIds,
                    oldMessageItemCount: messageItemCount,
                    isReading,
                }
            })
            let newMessages = oldMessages, newMessageItemCount = oldMessageItemCount, unreadAtSignMessage = null
            const newUnreadIds = []
            if (chatList && chatList.length) {
                const userLastReadAtTime = lastReadMessageTime ? new Date(lastReadMessageTime) : 0
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

                    newMessageItemCount++
                    const isMessageReaded = userLastReadAtTime > new Date(m.time)

                    // 未读时进行提醒处理
                    if (!isMessageReaded && !isReading && m.fromId !== userId) {
                        newUnreadIds.push(m.id)
                    }
                    // @消息进行格式化
                    if (m.content) {
                        const { atSign = [], text = '' } = m.content
                        m.content.text = formatAtSignMessage(atSign, text)
                        // 如果未读进行提醒处理
                        if (!isMessageReaded && atSign.some(i => i.atSignToUserId === userId) && m.fromId !== userId) {
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
        * searchMedia({ payload }, { put, }) {
            const actionId = socket.emit(ServerListenSocketEvents.searchMedia, payload)
            const res = yield socket.awaitActionResponse(actionId)
            if (!res.success) {
                return
            }
            yield put({
                type: 'saveData',
                payload: {
                    searchMediaList: res.list
                }
            })
        },
        * searchMediaDetail({ payload }, { put, }) {
            const actionId = socket.emit(ServerListenSocketEvents.getMediaDetail, payload)
            const res = yield socket.awaitActionResponse(actionId)
            if (!res.success) {
                return
            }
            yield put({
                type: 'saveData',
                payload: {
                    searchMediaDetail: res.detail
                }
            })
        },
    },
    reducers: {
        initState: (state, {payload = {}}) => {
            const {exclude = []} = payload
            const oldValues: Partial<ChatListModelState> = {}
            exclude.forEach(key => {
                oldValues[key] = state[key]
            })
            return Object.assign(getInitState(), oldValues)
        },
        saveData: (state, { payload }) => {
            return {
                ...state,
                ...payload
            }
        },
        setEmojiList: (state, { payload }) => {
            return {
                ...state,
                hasMoreEmoji: payload.hasMoreEmoji,
                emojiList: state.emojiList.concat(payload.emojiList)
            }
        },
        handleAtSignAction: (state, { payload }) => {
            const { atSignToUserId, atSignToUserName } = payload
            const inputMessageObj = state.inputMessageObj || {}
            const { atSign = [], text = '' } = inputMessageObj
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
        addDanmuItems: (state, { payload }) => {
            let { danmuList } = state
            const { items } = payload
            const newDanmuItems: MessageItem[] = []
            let lastDanmuItemTime = null
            items.forEach((item: MessageItem) => {
                const time = new Date(item.time)
                if (time < state.lastReadDanmuItemTime) {
                    return
                }
                if (![MessageTypes.notification, MessageTypes.emoji].includes(item.type)) {
                    newDanmuItems.push({
                        ...item,
                    })
                    lastDanmuItemTime = new Date(item.time)
                }
            })
            danmuList = danmuList.concat(newDanmuItems)
            return {
                ...state,
                danmuList,
                lastReadDanmuItemTime: lastDanmuItemTime || state.lastReadDanmuItemTime
            }
        },
        selectMessageItem: (state, { payload }) => {
            const { selectedMessageItem } = payload
            const {type} = selectedMessageItem as MessageItem
            if ([MessageTypes.notice, MessageTypes.notification].includes(type)) {
                return state
            }
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
        handleWithdrawlMessageItems: (state, {payload}) => {
            const {ids = []} = payload
            const {messages} = state
            const idSet = new Set(ids)
            return {
                ...state,
                messages: messages.map(subArr => {
                    subArr = subArr.map(item => {
                        if (idSet.has(item.id)) {
                            return {
                                id: Date.now().toString(),
                                type: MessageTypes.notification,
                                from: '系统消息',
                                content: {
                                    text: '该消息已被撤回'
                                },
                                time: Date.now(),
                            }
                        }
                        return item
                    })
                   return subArr
                })
            }
        },
    },
    subscriptions: {
        listenSocket(api) {
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
            socket.on(ClientListenSocketEvents.updateRoomCutMusicVoteInfo, (voteAction) => {
                api.dispatch({
                    type: 'updateVoteAction',
                    payload: {
                        voteAction
                    }
                })
            })
            socket.on(ClientListenSocketEvents.withdrawlChatListMessage, (ids) => {
                api.dispatch({
                    type: 'handleWithdrawlMessageItems',
                    payload: {
                        ids
                    }
                })
            })
        },
    }
}

export default ChatListModel
