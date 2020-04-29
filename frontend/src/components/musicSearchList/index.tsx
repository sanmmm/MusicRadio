import React, { useEffect, useState, useMemo, useCallback } from 'react'
import bindClass from 'classnames'
import { connect } from 'dva'
import { useMediaQuery } from 'react-responsive'
import ScrollBar from 'react-perfect-scrollbar'

import { CustomTextFeild, CustomBtn } from '@/utils/styleInject'
import HashRoute, { hashRouter } from '@/components/hashRouter'
import FocusMobileInputWrapper from '@/components/focusMobileInput'
import { ConnectState, ConnectProps, ChatListModelState, PlayListModelState, } from '@/models/connect'
import { MediaTypes, searchMediaItem } from 'config/type.conf'
import configs from 'config/base.conf'
import { joinPath, isPathEqual } from '@/utils'
import styles from './index.less'
import CustomIcon from '@/components/CustomIcon';


interface Props extends ConnectProps {
    nowRoomId: string;
    isRoomAdmin: boolean;
    list: ChatListModelState['searchMediaList'];
    playList: PlayListModelState['playList'];
    mediaDetail: ChatListModelState['searchMediaDetail'];
    baseHashPath?: string;
    searchMediaListPending: boolean;
    searchMediaDetailPending: boolean;
}

const SearchResultTypesToLabel = {
    [MediaTypes.album]: '专辑',
    [MediaTypes.song]: '单曲'
}

const MusicSearchList: React.FC<Props> = (props) => {
    const { list = [], dispatch, playList, mediaDetail, baseHashPath = '', nowRoomId, searchMediaDetailPending, searchMediaListPending, isRoomAdmin } = props
    const isMobile = useMediaQuery({ query: configs.mobileMediaQuery })
    const [searchValue, setSearchValue] = useState('')

    useEffect(() => {
        dispatch({
            type: 'center/saveData',
            payload: {
                searchMediaList: [],
                searchMediaDetail: null,
            }
        })
    }, [])

    useEffect(() => {
        dispatch({
            type: 'center/saveData',
            payload: {
                searchMediaList: []
            }
        })
    }, [])

    const playListIdSet = useMemo(() => {
        const set = new Set()
        if (!playList) {
            return set
        }
        playList.forEach(i => set.add(i.id))
        return set
    }, [playList])

    const handleSearch = useCallback(() => {
        if (!searchValue) {
            return
        }
        dispatch({
            type: 'chatList/searchMedia',
            payload: {
                keywords: searchValue
            }
        })
    }, [searchValue])

    const addMusic = (ids: string[]) => {
        dispatch({
            type: 'playList/addMusicToPlayList',
            payload: {
                roomId: nowRoomId,
                ids,
            }
        })
    }

    const handleSelect = useCallback((item: searchMediaItem) => {
        if (item.type === MediaTypes.song) {
            if (playListIdSet.has(item.id)) {
                return
            }
           addMusic([item.id])
        } else {
            hashRouter.push(joinPath(baseHashPath, '/step2'))
            dispatch({
                type: 'chatList/searchMediaDetail',
                payload: {
                    id: item.id
                }
            })
        }
    }, [baseHashPath, nowRoomId])

    const handleKeyDown = useCallback((event) => {
        if (event.key === 'Enter') {
            handleSearch()
        }
    }, [handleSearch])

    const handleSelectAll = () => {
        if (mediaDetail.list) {
            addMusic(mediaDetail.list.map(o => o.id))
        }
    }

    const renderDetailItemList = (list: searchMediaItem[], key = null) => {
        return <div className={styles.detailItemsList} key={key}>
            {list.map(i => {
                return <div key={i.id} className={styles.item} onClick={_ => handleSelect(i)}>
                    {
                        !!i.pic &&
                        <div className={styles.left}>
                            <img src={i.pic} />
                        </div>
                    }
                    <div className={styles.right}>
                        <div className={styles.content}>
                            <div className={styles.title} title={i.title}>{i.title}</div>
                            <div className={styles.desc} title={i.desc}>{i.desc}</div>
                        </div>
                        <div className={styles.actions}>
                            {
                                playListIdSet.has(i.id) ? <span className={styles.added}>已添加</span> :
                                    <CustomIcon>add</CustomIcon>}
                        </div>
                    </div>
                </div>
            })}
        </div>
    }

    return <div className={styles.searchMediaListBox}>

        <HashRoute path={joinPath(baseHashPath, '/')} >
            {
                (_, pathname) => {
                    const isExactMatched = isPathEqual(pathname, joinPath(baseHashPath, '/'))
                    return <React.Fragment>
                        {
                            <div className={bindClass(styles.step1Box, !isExactMatched && styles.hide)}>
                                <ScrollBar className={styles.searchList}>
                                    {
                                        searchMediaListPending ?
                                            <div className={styles.loading}>
                                                <CustomIcon>load</CustomIcon>
                                            </div> :
                                            (
                                                list.length ? list.map(item => {
                                                    if (!item.list.length) {
                                                        return null
                                                    }
                                                    return <div className={styles.subListItem} key={item.type}>
                                                        <div className={styles.header}>{SearchResultTypesToLabel[item.type]}</div>
                                                        {renderDetailItemList(item.list, item.type)}
                                                    </div>
                                                }) :
                                                    <div className={styles.noData}>
                                                        暂无数据
                                </div>
                                            )
                                    }
                                </ScrollBar>
                                <FocusMobileInputWrapper>
                                    {
                                        (inputRef, isFocus) => <div className={styles.searchArea}>
                                            <CustomTextFeild inputRef={inputRef} fullWidth={true} placeholder="搜索音乐" value={searchValue}
                                                onChange={(e) => {
                                                    console.log(e.target.value, 'v')
                                                    setSearchValue(e.target.value)
                                                }}
                                                onKeyDown={handleKeyDown}
                                                disabled={searchMediaListPending}
                                            />
                                            <CustomBtn onClick={handleSearch} disabled={searchMediaListPending}>搜索</CustomBtn>
                                        </div>}
                                </FocusMobileInputWrapper>
                            </div>}
                        <HashRoute path={joinPath(baseHashPath, '/step2')} exact={true}>
                            <div className={styles.step2Box}>
                                {
                                    searchMediaDetailPending ?
                                        <div className={styles.loading}>
                                            <CustomIcon>load</CustomIcon>
                                        </div> :
                                        (
                                            mediaDetail ? <ScrollBar className={styles.detail}>
                                                <div className={styles.header}>
                                                    <div className={styles.name}>《{mediaDetail.name}》</div>
                                                    <div className={styles.actions}>
                                                        {
                                                            isRoomAdmin && <div className={bindClass(styles.btn, isMobile && styles.mobile)} onClick={handleSelectAll}>
                                                                <CustomIcon>check-circle</CustomIcon>
                                                                <span>全部添加</span>
                                                            </div>}
                                                    </div>
                                                </div>
                                                <div className={styles.list}>
                                                    {
                                                        renderDetailItemList(mediaDetail.list || [])
                                                    }
                                                </div>
                                            </ScrollBar> :
                                                <div className={styles.noData}>
                                                    暂无数据
                                </div>
                                        )
                                }

                            </div>
                        </HashRoute>
                    </React.Fragment>
                }

            }
        </HashRoute>
    </div>
}

export default connect<Exclude<Props, 'baseHashPath'>, any, Pick<Props, 'baseHashPath'>>(({ chatList, playList, center, loading }: ConnectState) => {
    return {
        searchMediaDetailPending: loading.effects['chatList/searchMediaDetail'],
        searchMediaListPending: loading.effects['chatList/searchMedia'],
        list: chatList.searchMediaList,
        mediaDetail: chatList.searchMediaDetail,
        playList: playList.playList,
        nowRoomId: center.nowRoomInfo ? center.nowRoomInfo.id : null,
        isRoomAdmin: center.isRoomAdmin,
    }
})(MusicSearchList)
