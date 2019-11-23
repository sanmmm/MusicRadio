import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import bindClass from 'classnames'
import { connect } from 'dva'
import ScrollBar from 'react-perfect-scrollbar'
import { useMediaQuery } from 'react-responsive'

import { throttle } from '@/utils'
import configs from '@/config'
import styles from './index.less'
import { ConnectState, ChatListModelState, ConnectProps } from '@/models/connect'
interface Props extends ConnectProps {
    emojiList: ChatListModelState['emojiList'];
    hasMore: boolean;
}

const pageSize = 20

enum ImageLoadingStatus { loadEnd = 1, loading = 2}

const EmojiSearchLsit: React.FC<Props> = function (props) {
    const { emojiList, hasMore, dispatch } = props
    const boxRef = useRef(null)
    const isMobile = useMediaQuery({ query: configs.mobileMediaQuery })
    const emojiItemPerLine = isMobile ? 4 : 2
    const [scrollEle, setScrollEle] = useState(null as HTMLElement)
    const [visibleImgMap, setVisibleImgMap] = useState({} as {
        [key: string]: ImageLoadingStatus
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
        const lastId = emojiList.length ? emojiList[0].id : ''
        fetchEmojiList(lastId)
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
        const scrollY = (scrollEle.clientHeight + scrollEle.scrollTop)
        scrollEle.querySelectorAll(`.${styles.item}`).forEach((ele: HTMLElement) => {
            const eleId = ele.getAttribute('data-id')
            if (visibleImgMap[eleId]) {
                return
            }
            const offsetTop = ele.offsetTop
            if (offsetTop - scrollY < 20) {
                visibleImgMap[eleId] = ImageLoadingStatus.loading
            }
        })
        setVisibleImgMap({ ...visibleImgMap })
    }, [scrollEle, visibleImgMap])

    useEffect(() => {
        if (!scrollEle) {
            return
        }
        calcImgLazyLoadStatus()
    }, [!!scrollEle])

    const handleScroll = useCallback(throttle((e) => {
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
            fetchEmojiList(emojiList[0].id)
        }
    }, 400, true), [scrollEle, emojiList, calcImgLazyLoadStatus])


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
                                style={{ width: `${(1 / emojiItemPerLine) * 100}%` }}>
                                {
                                    visibleImgMap[e.id] && <React.Fragment>
                                        <img src={e.src}
                                            className={bindClass(isImgLoading && styles.loading)}
                                            onLoad={_ => {
                                                visibleImgMap[e.id] = ImageLoadingStatus.loadEnd
                                                setVisibleImgMap({ ...visibleImgMap })
                                            }} />
                                        {
                                            isImgLoading && <span className="iconfont icon-load"></span>
                                        }
                                    </React.Fragment>
                                }
                            </div>
                        }
                        )
                    }
                </ScrollBar> :
                    <div className={styles.noData}>
                        暂无数据
                   </div>}
        </div>
    </div>
}

export default connect(({ chatList }: ConnectState) => {
    return {
        emojiList: chatList.emojiList,
        hasMore: chatList.hasMoreEmoji,
    }
})(EmojiSearchLsit)
