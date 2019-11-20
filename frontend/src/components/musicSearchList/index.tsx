import React, { useEffect, useState, useMemo, useRef } from 'react'
import bindClass from 'classnames'
import { connect } from 'dva'
import { useMediaQuery } from 'react-responsive'
import { Input } from 'antd'
import ScrollBar from 'react-perfect-scrollbar'

import useKeyBoardListen from '@/components/hooks/keyboardListen'
import { ConnectState, ConnectProps, CenterModelState, PlayListModelState } from '@/models/connect'
import { MediaTypes, SearchMusicItem } from '@/typeConfig'
import configs from '@/config'
import styles from './index.less'

const { Search } = Input

type ListType = CenterModelState['searchMusicList']

interface Props extends ConnectProps {
    list: ListType;
    playList: PlayListModelState['playList'];
    mediaDetail: CenterModelState['searchMediaDetail'];
}

const SearchResultTypesToLabel = {
    [MediaTypes.album]: '专辑',
    [MediaTypes.song]: '单曲'
}

enum Steps { step1 = 'step1', step2 = 'step2' }

const MusicSearchList: React.FC<Props> = (props) => {
    const { list = [], dispatch, playList, mediaDetail } = props
    const isMobile = useMediaQuery({ query: configs.mobileMediaQuery })
    const [nowRouterHash, setRouterHash] = useState(Steps.step1)
    const boxRef = useRef<HTMLDivElement>(null)
    const inputRef = useKeyBoardListen({
        onShow: () => console.log('show'),
        onHide: () => console.log('hide'),
    })

    useEffect(() => {
        const handler = (e) => {
            e.stopPropagation()
        }
        boxRef.current.addEventListener('touchstart', handler)
        return () => {
            boxRef.current.removeEventListener('touchstart', handler)
        }
    }, [])
    const initHistoryLength = useMemo(() => {
        return history.length
    }, [])
    useEffect(() => {
        location.hash = nowRouterHash
        const handler = (e) => {
            setRouterHash(location.hash.replace('#', '') as Steps)
        }
        window.addEventListener('hashchange', handler)
        return () => {
            window.removeEventListener('hashchange', handler)
            if (history.length > initHistoryLength) {
                history.go(initHistoryLength - history.length)
            }
        }
    }, [])

    useEffect(() => {
        dispatch({
            type: 'center/saveData',
            payload: {
                searchMusicList: []
            }
        })
    }, [])
    const playListIdSet = useMemo(() => {
        const set = new Set()
        if (playList) {
            return set
        }
        playList.forEach(i => set.add(i.id))
        return set
    }, [playList])
    const handleSerach = useMemo(() => {
        return (v) => {
            if (!v) {
                return
            }
            dispatch({
                type: 'center/Music',
                payload: {

                }
            })
        }
    }, [])

    const handleSelect = useMemo(() => {
        return (item) => {
            if (item.type === MediaTypes.song) {
                //TODO dispatch
                dispatch({
                    type: 'center/addMusicToPlayList',
                    payload: {}
                })
            } else {
                location.hash = Steps.step2
                dispatch({
                    type: 'center/reqMediaDetail',
                    payload: {}
                })
            }
        }
    }, [])

    const renderDetailItemList = (list: SearchMusicItem[], key = null) => {
        return <div className={styles.detailItemsList} key={key}>
            {list.map(i => {
                return <div key={i.id} className={styles.item} onClick={_ => handleSelect(i)}>
                    <div className={styles.left}>
                        <img src={i.pic} />
                    </div>
                    <div className={styles.right}>
                        <div className={styles.content}>
                            <div className={styles.title}>{i.title}</div>
                            <div className={styles.desc}>{i.desc}</div>
                        </div>
                        <div className={styles.actions}>
                            {
                                playListIdSet.has(i.id) ? <span className={styles.added}>已添加</span> :
                                    <span className={bindClass('iconfont', 'icon-add')}></span>}
                        </div>
                    </div>
                </div>
            })}
        </div>
    }

    return <div ref={boxRef} className={styles.searchMusicListBox} style={{height: isMobile ? '40vh' : '50vh'}}  
            onWheel={e => e.stopPropagation()}
        >
            <input ref={inputRef}/>
        {
            nowRouterHash === Steps.step1 &&
            <div className={styles.step1Box}>
                <ScrollBar className={styles.searchList}>
                {
                    list.map(item => {
                        if (!item.list.length) {
                            return null
                        }
                        return <div className={styles.subListItem} key={item.type}>
                            <div className={styles.header}>{SearchResultTypesToLabel[item.type]}</div>
                            {renderDetailItemList(item.list, item.type)}
                        </div>
                    })
                }
                </ScrollBar>
                    
                <div className={styles.searchArea}>
                    <Search style={{ width: '100%' }} placeholder="搜索" onSearch={handleSerach} />
                </div>
            </div>
        }
        {
            (nowRouterHash === Steps.step2) && <div className={styles.step2Box}>
                <div className={styles.header} onClick={_ => location.hash = Steps.step1}><span className="iconfont icon-back-circle"></span><span>返回</span></div>    
                {
                    mediaDetail && <ScrollBar className={styles.detail}>
                        <div className={styles.header}>
                            <div className={styles.name}>《{mediaDetail.name}》</div>
                            <div className={styles.actions}>
                                <div className={bindClass(styles.btn, isMobile && styles.mobile)}>
                                    <span className="iconfont icon-check-circle"></span>
                                    <span>全部添加</span>
                                </div>
                            </div>
                        </div>
                        <div className={styles.list}>
                            {
                                renderDetailItemList(mediaDetail.list || [])
                            }
                        </div>
                    </ScrollBar>}
                {
                    !mediaDetail && <div className={styles.noData}>
                        暂无数据
                    </div>}
            </div>}
    </div>
}

export default connect(({ center, playList }: ConnectState) => {
    return {
        list: center.searchMusicList,
        mediaDetail: center.searchMediaDetail,
        playList: playList.playList,
    }
})(MusicSearchList)
