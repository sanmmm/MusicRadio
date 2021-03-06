import React, { useEffect, useState, useRef, useReducer, useCallback } from 'react'
import bindClass from 'classnames'
import { connect } from 'dva'
import ScrollBar from 'react-perfect-scrollbar'
import { useMediaQuery } from 'react-responsive'

import { throttle } from '@/utils'
import configs from 'config/base.conf'
import styles from './index.less'
import { ConnectState, ChatListModelState, ConnectProps } from '@/models/connect'
import CustomIcon from '@/components/CustomIcon';

interface Props extends ConnectProps {
    roomId: string;
    emojiList: ChatListModelState['emojiList'];
    hasMore: boolean;
    loadingEmojiList: boolean;
    sendMessagePending: boolean;
    onClose: () => any;
}

const pageSize = 20

enum ImageLoadingStatus { loadEnd = 1, loading = 2 }


const Loading = React.memo<{ full?: boolean, text?: string, className?: string }>((props) => {
    const { full = false, text = '', className: appendClass } = props
    return <div className={bindClass(styles.loading, full && styles.full, appendClass)}>
        <CustomIcon>load</CustomIcon>
        {
            !!text && <span className={styles.text}>{text}</span>}
    </div>
})


const EmojiSearchLsit = React.memo<Props>(function (props) {
    const { emojiList, hasMore, dispatch, loadingEmojiList, sendMessagePending, roomId } = props
    const boxRef = useRef(null)
    const isMobile = useMediaQuery({ query: configs.mobileMediaQuery })
    const emojiItemPerLine = isMobile ? 4 : 3
    const [scrollEle, setScrollEle] = useState(null as HTMLElement)
    const [visibleImgMap, setVisibleImgMap] = useState({} as {
        [key: string]: ImageLoadingStatus;
    })

    const fetchEmojiList = (lastId = '') => {
        dispatch({
            type: 'chatList/reqEmojiList',
            payload: {
                lastId: lastId,
                limit: pageSize
            }
        })
    }

    useEffect(() => {
        if (hasMore && emojiList.length === 0) {
            fetchEmojiList(null)
        }
    }, [])

    useEffect(() => {
        const handler = (e) => {
            e.stopPropagation()
        }
        boxRef.current.addEventListener('touchstart', handler)
        return () => {
            boxRef.current.removeEventListener('touchstart', handler)
        }
    }, [])

    const calcImgLazyLoadStatus = useCallback(() => {
        if (!scrollEle) {
            return
        }
        requestAnimationFrame(() => {
            const scrollY = (scrollEle.clientHeight + scrollEle.scrollTop)
            const obj = {}
            scrollEle.querySelectorAll(`.${styles.item}`).forEach((ele: HTMLElement) => {
                const eleId = ele.getAttribute('data-id')
                if (visibleImgMap[eleId]) {
                    return
                }
                const offsetTop = ele.offsetTop
                if (offsetTop - scrollY < 20) {
                    obj[eleId] = ImageLoadingStatus.loading
                }
            })
            setVisibleImgMap((visibleImgMap) => {
                return {
                    ...visibleImgMap,
                    ...obj
                }
            })
        })
    }, [scrollEle, visibleImgMap])

    useEffect(() => {
        if (!scrollEle) {
            return
        }
        calcImgLazyLoadStatus()
    }, [!!scrollEle])

    const handleScroll = throttle((e) => {
        //TODO 通过提前计算高度优化性能
        if (!emojiList.length) {
            return
        }
        if (!scrollEle) {
            return
        }
        calcImgLazyLoadStatus()
        if (!hasMore) {
            return
        }
        if (scrollEle.scrollHeight - (scrollEle.scrollTop + scrollEle.clientHeight) < 30) {
            if (loadingEmojiList || !hasMore) {
                return
            }
            fetchEmojiList(emojiList[emojiList.length - 1].id)
        }
    }, 400, true)

    const handleEmojiClick = (item: Props['emojiList'][0]) => {
        if (sendMessagePending) {
            // TODO 
            return
        }
        dispatch({
            type: 'chatList/sendMessage',
            payload: {
                emojiId: item.id,
                roomId
            }
        }).then(success => {
            if (success) {
                props.onClose && props.onClose()
            }
        })
    }

    return <div onWheel={e => e.stopPropagation()} ref={boxRef} className={styles.emojiSearchBox}>
        <div className={styles.container}>
            {
                emojiList.length ? <ScrollBar className={styles.emojiList}
                    containerRef={node => {
                        setScrollEle(node)
                    }}
                    onScrollDown={handleScroll}
                >
                    {
                        emojiList.map(e => {
                            const isImgLoading = visibleImgMap[e.id] === ImageLoadingStatus.loading
                            return <div key={e.id} data-id={e.id} className={styles.item} title={e.title}
                                    style={{ width: `${(1 / emojiItemPerLine) * 100}%` }}
                                    onClick={handleEmojiClick.bind(null, e)}
                                >
                                {
                                    visibleImgMap[e.id] && <React.Fragment>
                                        <img src={e.src}
                                            className={bindClass(isImgLoading && styles.loading)}
                                            onLoad={_ => {
                                                setVisibleImgMap((visibleImgMap) => {
                                                    visibleImgMap[e.id] = ImageLoadingStatus.loadEnd
                                                    return { ...visibleImgMap }
                                                })
                                            }} />
                                        {
                                            isImgLoading && <CustomIcon>load</CustomIcon>
                                        }
                                    </React.Fragment>
                                }
                            </div>
                        }
                        )

                    }
                    {
                        loadingEmojiList && <Loading text="加载中" />
                    }
                    {
                        !hasMore && <div className={styles.noMore}>
                            <span>没有更多了..</span>
                        </div>}
                </ScrollBar> :
                    (
                        loadingEmojiList ?
                            <Loading full={true} /> :
                            <div className={styles.noData}>
                                暂无数据
                    </div>
                    )}
        </div>
    </div>
})

export default connect(({ chatList, loading, center: {userInfo}}: ConnectState) => {
    return {
        roomId: userInfo && userInfo.nowRoomId,
        loadingEmojiList: loading.effects['chatList/reqEmojiList'],
        emojiList: chatList.emojiList,
        hasMore: chatList.hasMoreEmoji,
        sendMessagePending: loading.effects['chatList/sendMessage'],
    }
})(EmojiSearchLsit)
