import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import bindClass from 'classnames'
import ScorllBar from 'react-perfect-scrollbar'
import dayjs, { Dayjs } from 'dayjs'
import { connect } from 'dva'
import { useMediaQuery } from 'react-responsive'
import { useSwipeable } from 'react-swipeable'

import { ConnectState, ConnectProps, ChatListModelState } from '@/models/connect'
import useSyncState from '@/components/hooks/syncAccessState'
import usePreventSwipe from '@/components/hooks/preventScrollAndSwipe'
import { MessageTypes, MessageItem, ChatListNoticeTypes } from 'config/type.conf'
import configs from 'config/base.conf'
import styles from './index.less'
import bindclass from 'classnames';
import CustomIcon from '@/components/CustomIcon';
import { urlCompatible } from '@/utils';

interface ChatListProps extends ConnectProps {
    unreadMessageIds: string[];
    renderMessages: MessageItem[][];
    nowUserId: string;
    isReading: boolean;
    messageItemCount: number;
    unreadAtSignMessage: ChatListModelState['unreadAtSignMessage'];
    unreadVoteMessage: ChatListModelState['unreadVoteMessage'];
    className?: string;
}

const inferIsReadingOffset = 60

function getElementNodeOffsetTopPostion(ele: HTMLElement, cb: (offset: number) => any) {
    requestAnimationFrame(() => {
        cb(ele.offsetTop)
    })
}

enum Directions {
    up = 1,
    down
}

const ChatList: React.FC<ChatListProps> = React.memo(function (props) {
    const { nowUserId, renderMessages, unreadMessageIds, dispatch, isReading, messageItemCount, unreadVoteMessage, unreadAtSignMessage, className } = props
    const [getSyncState, setSyncState] = useSyncState({
        unreadMessagePosition: new Map(),
        containerScrollTop: 0,
        containerClientHeight: 0,
        containerBottomOffset: null,
        unreadAtSignMessagePositon: 0,
        unreadVoteMessagePosition: 0,
    } as {
        unreadMessagePosition: Map<string, number>;
        containerScrollTop: number;
        containerClientHeight: number;
        containerBottomOffset: number;
        unreadAtSignMessagePositon: number;
        unreadVoteMessagePosition: number;
    })
    const [unreadAtSignMessageDirection, setAtSignMessageDirection] = useState(null as Directions)
    const [unreadVoteMessageDirection, setVoteMessageDirection] = useState(null as Directions)
    const containerRef = useRef<HTMLElement>(null)
    const placeholderRef = useRef<HTMLDivElement>(null)
    const chatListBoxRef = usePreventSwipe()

    useEffect(() => {
        dispatch({
            type: 'chatList/saveData',
            payload: {
                onScrollToBottom: () => {
                    if (placeholderRef.current) {
                        placeholderRef.current.scrollIntoView(false)
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
                placeholderRef.current.scrollIntoView(false)
            }
        }
    }, [renderMessages.length !== 0])

    useEffect(() => {
        if (isReading && placeholderRef.current && !!messageItemCount) {
            placeholderRef.current.scrollIntoView(false)
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

    const updateUnreadMessageItemStatus = () => {
        const { containerScrollTop, containerClientHeight, containerBottomOffset, unreadMessagePosition } = getSyncState()
        if (!unreadMessagePosition || !unreadMessagePosition.size) {
            return
        }
        const markReadArr = []
        unreadMessagePosition.forEach((postion, id) => {
            if (containerScrollTop + containerClientHeight > postion) {
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
                    updateUnreadMessageItemStatus()
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
        if (!containerNode) {
            return
        }
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
            if (unreadVoteMessage || unreadAtSignMessage) {
                updateUnreadNoticeItemsDirection()
            }
            updateUnreadMessageItemStatus()
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

    const updateUnreadNoticeItemsDirection = () =>  {
        const {unreadAtSignMessagePositon, unreadVoteMessagePosition, containerClientHeight, containerScrollTop} = getSyncState()
        const max = containerClientHeight + containerScrollTop
        const min = containerScrollTop
        const getDirection = (offsetTop: number) => {
            return offsetTop > max ? Directions.down : (
                offsetTop < min ? Directions.up : null
            )
        }
        const direction1 = getDirection(unreadAtSignMessagePositon)
        setAtSignMessageDirection(direction1)
        const direction2 = getDirection(unreadVoteMessagePosition)
        setVoteMessageDirection(direction2)
    }

    const handleUnreadVoteNoticeClose = useCallback(() => {
        dispatch({
            type: 'chatList/saveData',
            payload: {
                unreadVoteMessage: null
            }
        })
    }, [])

    const handleUnreadAtSignNoticeClose = useCallback(() => {
        dispatch({
            type: 'chatList/saveData',
            payload: {
                unreadAtSignMessage: null
            }
        })
    }, [])

    const handleUnreadMessageNoticeClick = useCallback(() => {
        if (placeholderRef.current) {
            placeholderRef.current.scrollIntoView(false)
        }
        
    }, [])

    const handleUnreadAtSignNoticeClick = useCallback(() => {
        const {unreadAtSignMessagePositon} = getSyncState()
        if (containerRef.current) {
            containerRef.current.scrollTop = unreadAtSignMessagePositon
        }
        dispatch({
            type: 'chatList/saveData',
            payload: {
                unreadAtSignMessage: null
            }
        })
    }, [])

    const handleUnreadVoteNoticeClick = useCallback(() => {
        const {unreadVoteMessagePosition} = getSyncState()
        if (containerRef.current) {
            containerRef.current.scrollTop = unreadVoteMessagePosition
        }
        dispatch({
            type: 'chatList/saveData',
            payload: {
                unreadVoteMessage: null
            }
        })
    }, [])


    const handleAtSignMessageItemRef = useCallback((ele) => {
        if (!ele) {
            return
        }
        getElementNodeOffsetTopPostion(ele, (offsetTop) => {
            setSyncState({
                ...getSyncState(),
                unreadAtSignMessagePositon: offsetTop,
            })
            updateUnreadNoticeItemsDirection()
        })
    }, [])

    const handleVoteMessageItemRef = useCallback((ele) => {
        if (!ele) {
            return
        }
        getElementNodeOffsetTopPostion(ele, (offsetTop) => {
            setSyncState({
                ...getSyncState(),
                unreadVoteMessagePosition: offsetTop,
            })
            updateUnreadNoticeItemsDirection()
        })
    }, [])

    const nowDate = dayjs().date(), nowMonth = dayjs().month(), nowYear = dayjs().year()
    const unreadAtSignMessageId = unreadAtSignMessage ? unreadAtSignMessage.id : -1
    const unreadVoteMessageId = unreadVoteMessage ? unreadVoteMessage.id : -1
    const refObj = {
        [unreadAtSignMessageId]: handleAtSignMessageItemRef,
        [unreadVoteMessageId]: handleVoteMessageItemRef,
    }
    return <div className={bindclass(styles.chatListBox, className || '')} ref={chatListBoxRef}>
        <div className={styles.noticeBox} >
            <NoticeItem
                onClose={handleUnreadAtSignNoticeClose}
                onClick={handleUnreadAtSignNoticeClick}
                arrowDirection={unreadAtSignMessageDirection}
                show={!!unreadAtSignMessage}
                text={'有人@您'}
            />
            <NoticeItem
                onClose={handleUnreadVoteNoticeClose}
                onClick={handleUnreadVoteNoticeClick}
                arrowDirection={unreadVoteMessageDirection}
                show={!!unreadVoteMessage}
                text={'有新的投票！'}
            />
            <NoticeItem
                onClose={handleUnreadNoticeClose}
                onClick={handleUnreadMessageNoticeClick}
                arrowDirection={Directions.down}
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
                       
                        return <React.Fragment key={i}>
                            <div className={bindClass(styles.messageItemSubArr, styles.messageItem, styles.time)}><span>{startDateStr}</span></div>
                            {
                                msgs.map((m, index) => <ChatListItem key={`${i}-${index}`} message={m} handleClick={handleClick} nowUserId={nowUserId} unread={unreadMessageIds.includes(m.id)}
                                    onRef={refObj[m.id]}
                                />)}
                        </React.Fragment>
                    })
                }
                <div ref={placeholderRef}></div>
            </ScorllBar>
        }
    </div>
})

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
    onRef?: (node: HTMLElement) => any;
    unread: boolean;
    nowUserId: string;
    message: MessageItem;
    handleClick: (message: MessageItem) => any;
}>((props) => {
    const { message: m, nowUserId, handleClick, unread, onRef } = props

    let content = null
    if (m.type === MessageTypes.notification) {
        content = <div key={m.id} data-id={m.id} className={bindClass(styles.messageItem, unread && styles.unread, styles.response)} ref={onRef ? onRef : null}>
            <span onClick={props.handleClick.bind(null, m)}>{m.content.text}</span>
        </div>
    } else {
        content = <div key={m.id} className={bindClass(styles.messageItem, unread && styles.unread)} data-id={m.id} ref={onRef ? onRef : null}>
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
                    m.type === MessageTypes.emoji ? <img src={urlCompatible(m.content.img)} title={m.content.title} onClick={handleClick.bind(null, m)} /> : <span onClick={handleClick.bind(null, m)}>{m.content.text}</span>}
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
    arrowDirection?: Directions;
}>((props) => {
    const { show, arrowDirection, onClick, onClose, text = '' } = props
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

    const handlers = isMobile ? useSwipeable({
        onSwipedRight: handleClose
    }) : {}

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
            const { swipeTimer } = state
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
        if (!show && ![null, noticeItemStatus.willHide].includes(status)) {
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
        {
            !!arrowDirection &&
            <CustomIcon className={styles.icon}>
                {
                    arrowDirection === Directions.up ? 'double-arrow-up' : 'double-arrow-down'
                }
        </CustomIcon>
        }
        <span>{text}</span>
        {
            !isMobile && <CustomIcon className={styles.close} onClick={e => {
                e.stopPropagation()
                handleClose()
            }}>
                close
            </CustomIcon>}
    </div>
})
