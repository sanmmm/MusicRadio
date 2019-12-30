import React, { useEffect, useState, useRef, useCallback } from 'react'
import bindClass from 'classnames'
import ScorllBar from 'react-perfect-scrollbar'
import dayjs, { Dayjs } from 'dayjs'
import { connect } from 'dva'
import { useMediaQuery } from 'react-responsive'
import { useSwipeable } from 'react-swipeable'

import { ConnectState, ConnectProps, ChatListModelState } from '@/models/connect'
import useSyncState from '@/components/hooks/syncAccessState'
import usePreventSwipe from '@/components/hooks/preventScrollAndSwipe'
import { MessageTypes, MessageItem } from '@/typeConfig'
import configs from '@/config'
import styles from './index.less'

interface ChatListProps extends ConnectProps {
    unreadMessageIds: string[];
    renderMessages: MessageItem[][];
    nowUserId: string;
    isReading: boolean;
    messageItemCount: number;
    unreadAtSignMessage: ChatListModelState['unreadAtSignMessage'];
    unreadVoteMessage: ChatListModelState['unreadVoteMessage'];
}

const inferIsReadingOffset = 60

const ChatList: React.FC<ChatListProps> = function (props) {
    const { nowUserId, renderMessages, unreadMessageIds, dispatch, isReading, messageItemCount, unreadVoteMessage, unreadAtSignMessage } = props
    const [getSyncState, setSyncState] = useSyncState({
        unreadMessagePosition: new Map(),
        containerScrollTop: 0,
        containerClientHeight: 0,
        containerBottomOffset: null,
    } as {
        unreadMessagePosition: Map<string, number>;
        containerScrollTop: number,
        containerClientHeight: number,
        containerBottomOffset: number,
    })
    const containerRef = useRef<HTMLElement>(null)
    const placeholderRef = useRef<HTMLDivElement>(null)
    const chatListBoxRef = usePreventSwipe()

    useEffect(() => {
        dispatch({
            type: 'chatList/saveData',
            payload: {
                onScrollToBottom: () => {
                    if (placeholderRef.current) {
                        placeholderRef.current.scrollIntoView()
                    }
                }
            }
        })
        return () => {
            dispatch({
                type: 'chatList/saveData',
                payload: {
                    onScrollToBottom: null
                }
            })
        }
    }, [])

    useEffect(() => {
        if (renderMessages.length) {
            if (placeholderRef.current) {
                placeholderRef.current.scrollIntoView()
            }
        }
    }, [renderMessages.length !== 0])

    useEffect(() => {
        if (isReading && placeholderRef.current) {
            placeholderRef.current.scrollIntoView()
        }
    }, [messageItemCount])

    const markReadMessage = (ids: string[]) => {
        const markReadSet = new Set(ids)
        if (markReadSet.size) {
            const updatedUnreadMessages = unreadMessageIds.filter(id => !markReadSet.has(id))
            dispatch({
                type: 'chatList/saveData',
                payload: {
                    unreadMessageIds: [...updatedUnreadMessages]
                }
            })
        }
    }

    const handleContainerScrollTopChange = () => {
        const { containerScrollTop, containerClientHeight, containerBottomOffset, unreadMessagePosition } = getSyncState()
        const markReadArr = []
        unreadMessagePosition.forEach((postion, id) => {
            if (containerScrollTop + containerClientHeight - 10 > postion) {
                markReadArr.push(id)
                unreadMessagePosition.delete(id)
            }
        })
        markReadMessage(markReadArr)
    }

    const handleUnreadMessageIdChanged = () => {
        const needGetPostionIds: Set<string> = new Set()
        if (unreadMessageIds.length && containerRef.current) {
            const { unreadMessagePosition, containerBottomOffset } = getSyncState()
            unreadMessageIds.forEach(id => {
                if (unreadMessagePosition.has(id)) {
                    return
                }
                needGetPostionIds.add(id)
            })
            if (needGetPostionIds.size) {
                requestAnimationFrame(() => {
                    const unreadMessageNodeList = containerRef.current.getElementsByClassName(styles.unread)
                    const length = unreadMessageNodeList.length
                    for (let i = 0; i < length; i++) {
                        const node = unreadMessageNodeList[i] as HTMLElement
                        const id = node.attributes['data-id'].value
                        if (needGetPostionIds.has(id)) {
                            const offsetTop = node.offsetTop
                            unreadMessagePosition.set(id, offsetTop)
                        }
                    }
                    handleContainerScrollTopChange()
                })
            }
        }
    }

    useEffect(handleUnreadMessageIdChanged, [unreadMessageIds])

    const handleClick = useCallback((item) => {
        props.dispatch({
            type: 'chatList/selectMessageItem',
            payload: {
                selectedMessageItem: {
                    ...item
                }
            }
        })
    }, [])

    const updateSyncStateContainerInfo = (containerNode: HTMLElement) => {
        const { scrollTop, clientHeight, scrollHeight } = containerNode
        const obj = {
            containerScrollTop: scrollTop,
            containerClientHeight: clientHeight,
            containerBottomOffset: scrollHeight - scrollTop - clientHeight
        }
        setSyncState({
            ...getSyncState(),
            ...obj
        })
        return obj
    }

    const handleSetContainerNode = useCallback((node) => {
        containerRef.current = node
        if (!containerRef.current) {
            return
        }
        requestAnimationFrame(() => {
            updateSyncStateContainerInfo(containerRef.current)
        })
        handleUnreadMessageIdChanged()
    }, [])

    const handleContainerScroll = (e) => {
        requestAnimationFrame(() => {
            if (containerRef.current) {
                updateSyncStateContainerInfo(containerRef.current)
            }
            const { containerBottomOffset } = getSyncState()
            if (containerBottomOffset > inferIsReadingOffset && isReading) {
                dispatch({
                    type: 'chatList/saveData',
                    payload: {
                        isReading: false
                    }
                })
            }
            if (containerBottomOffset <= inferIsReadingOffset && !isReading) {
                dispatch({
                    type: 'chatList/saveData',
                    payload: {
                        isReading: true
                    }
                })
            }
            handleContainerScrollTopChange()
        })
    }

    const handleUnreadNoticeClose = useCallback(() => {
        dispatch({
            type: 'chatList/saveData',
            payload: {
                unreadMessageIds: []
            }
        })
    }, [])

    const handleUnreadNoticeClick = useCallback(() => {
        if (placeholderRef.current) {
            placeholderRef.current.scrollIntoView()
        }
    }, [])


    const nowDate = dayjs().date(), nowMonth = dayjs().month(), nowYear = dayjs().year()
    return <div className={styles.chatListBox} ref={chatListBoxRef}>
        <div className={styles.noticeBox} >
            <NoticeItem
                onClose={handleUnreadNoticeClose}
                onClick={handleUnreadNoticeClick}
                arrowDirection="down"
                show={!!unreadMessageIds.length}
                text={`${unreadMessageIds.length}条未读`}
            />
        </div>
        {
            !!renderMessages.length &&
            <ScorllBar style={{ height: '100%' }}
                containerRef={handleSetContainerNode}
                onScrollY={handleContainerScroll}
            >
                {
                    renderMessages.map((msgs, i) => {
                        const msgDate = dayjs(msgs[0].time)
                        // TODO 日期更精细化格式化
                        let formatStr = 'YYYY-MM-DD HH:mm'
                        if (msgDate.year() === nowYear) {
                            formatStr = 'MM-DD HH:mm'
                            if (msgDate.month() === nowMonth && msgDate.date() === nowDate) {
                                formatStr = 'HH:mm'
                            }
                        }

                        const startDateStr = dayjs(msgs[0].time).format(formatStr)
                        return <div key={i} className={styles.messageItemSubArr}>
                            <div className={bindClass(styles.messageItem, styles.time)}><span>{startDateStr}</span></div>
                            {
                                msgs.map((m, index) => <ChatListItem key={`${i}-${index}`} message={m} handleClick={handleClick} nowUserId={nowUserId} unread={unreadMessageIds.includes(m.id)} />)}
                        </div>
                    })
                }
                <div ref={placeholderRef}></div>
            </ScorllBar>
        }
    </div>
}

export default connect(({ chatList: { messages, unreadMessageIds, isReading, messageItemCount, unreadAtSignMessage, unreadVoteMessage }, center: { userInfo } }: ConnectState) => {
    return {
        messageItemCount,
        isReading,
        nowUserId: userInfo && userInfo.id,
        renderMessages: messages,
        unreadMessageIds,
        unreadAtSignMessage,
        unreadVoteMessage,
    }
})(ChatList)


const ChatListItem = React.memo<{
    unread: boolean;
    nowUserId: string;
    message: MessageItem;
    handleClick: (message: MessageItem) => any;
}>((props) => {
    const { message: m, nowUserId, handleClick, unread } = props

    let content = null
    if (m.type === MessageTypes.notification) {
        content = <div key={m.id} className={bindClass(styles.messageItem, unread && styles.unread, styles.response)} >
            <span onClick={props.handleClick.bind(null, m)}>{m.content.text}</span>
        </div>
    } else {
        content = <div key={m.id} className={bindClass(styles.messageItem, unread && styles.unread)} data-id={m.id}>
            <div className={styles.header}>
                {
                    m.type === MessageTypes.advanced ? `[${m.tag}] ` : (
                        m.fromId === nowUserId ? '[已发送] ' :
                            m.type === MessageTypes.notice && '[系统消息] '
                    )}
                {m.from}
            </div>
            <div className={bindClass(styles.content, m.type === MessageTypes.advanced && styles.advanced,
                m.type === MessageTypes.notice && styles.notice, m.type === MessageTypes.emoji && styles.emoji)}>
                {
                    m.type === MessageTypes.emoji ? <img src={m.content.img} title={m.content.title} onClick={handleClick.bind(null, m)} /> : <span onClick={handleClick.bind(null, m)}>{m.content.text}</span>}
            </div>
        </div>
    }
    return content
})

const animationDuration = 500

enum noticeItemStatus {
    show = 1,
    swipe,
    willHide,
}
const NoticeItem = React.memo<{
    text: string;
    show: boolean;
    onClick: () => any;
    onClose: () => any;
    arrowDirection: 'up' | 'down';
}>((props) => {
    const {show, arrowDirection, onClick, onClose, text = '' } = props
    const isMobile = useMediaQuery({ query: configs.mobileMediaQuery })

    const [status, setStatus] = useState(show ? noticeItemStatus.show : null)
    const [getSyncState, setSyncState] = useSyncState({
        swipeTimer: null as NodeJS.Timeout,
        swipeEndStatus: null as noticeItemStatus
    })

    const handleClose = () => {
        onClose && onClose()
        startSwipe()
    }

    const handlers = useSwipeable({
        onSwipedRight: handleClose
    })

    const startSwipe = () => {
        setStatus(noticeItemStatus.swipe)
        const timer = setTimeout(() => {
            setStatus(null)
        }, animationDuration)
        setSyncState({
            ...getSyncState(),
            swipeEndStatus: null,
            swipeTimer: timer
        })
    }

    const stopSwipe = (newStatus: noticeItemStatus, sync = true) => {
        const state = getSyncState()
        if (sync) {
            const {swipeTimer} = state
            swipeTimer && clearTimeout(swipeTimer)
            if (status === noticeItemStatus.swipe) {
                setStatus(newStatus)
            }
        } else {
            setSyncState({
                ...state,
                swipeEndStatus: newStatus,
            })
        }
    }

    useEffect(() => {
        if (show && status !== noticeItemStatus.show) {
            if (status === noticeItemStatus.swipe) {
                stopSwipe(noticeItemStatus.show)
            } else {
                setStatus(noticeItemStatus.show)
            }
        }
        if (!show) {
            if (status === noticeItemStatus.swipe) {
                stopSwipe(null, false)
                return
            }
            setStatus(noticeItemStatus.willHide)
            const timer = setTimeout(() => {
                setStatus(null)
            }, animationDuration)
            return () => {
                clearTimeout(timer)
            }
        }
    }, [show])

    return !!status && <div className={bindClass(styles.chatListNoticeItem, {
            [styles.show]: status === noticeItemStatus.show,
            [styles.hide]: status === noticeItemStatus.willHide,
            [styles.swipe]: status === noticeItemStatus.swipe,
        })} 
        {...handlers}
        onClick={onClick}
        style={{ animationDuration: `${animationDuration / 1000}s` }}
    >
        <span className={bindClass(styles.icon, 'iconfont', arrowDirection === 'up' ? 'icon-double-arrow-up' : 'icon-double-arrow-down')}></span>
        <span>{text}</span>
        {
            !isMobile && <span className={bindClass('iconfont icon-close', styles.close)}
                onClick={e => {
                    e.stopPropagation()
                    handleClose()
                }}
            ></span>}
    </div>
})
