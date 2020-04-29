import React, { useState, useMemo, useEffect } from 'react';
import { useMediaQuery } from 'react-responsive'
import bindClass from 'classnames'
import { connect } from 'dva'
import ScrollBar from 'react-perfect-scrollbar'
import { Button, IconButton, Fab, Zoom } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { ArrowUpwardRounded as ArrowUp } from '@material-ui/icons'

import RoomItemRender from '@/components/roomItem'
import { ConnectProps, ConnectState } from '@/models/connect'
import configs from 'config/base.conf'
import { RoomItem } from 'config/type.conf'
import styles from './style.less'
import styleConf from 'config/baseStyle.conf';

const useStyle = makeStyles({
    roomItem: {
        boxSizing: 'border-box',
        width: (props: any) => {
            return props.isMobile ? 'calc(100% - 2rem)' : `calc(20% - ${props.itemSpace * 2}rem)`
        },
        margin: (props: any) => {
            return props.isMobile ? '1rem' : `0 ${props.itemSpace}rem 2rem`
        },
    }
})
interface Props extends ConnectProps {
    roomList: RoomItem[];
    hasMore: boolean;
    isLoadingList: boolean;
    nowRoomId: string;
    isInShow: boolean;
    toPrevPage: () => any;
}

const RoomList: React.FC<Props> = (props) => {
    const { roomList, hasMore, dispatch, nowRoomId, isLoadingList, isInShow } = props
    const isMobile = useMediaQuery({ query: configs.mobileMediaQuery })
    const classes = useStyle({
        itemSpace: 1,
        isMobile,
    })

    useEffect(() => {
        loadListItem(roomList.length ? roomList[roomList.length - 1].id : null)
    }, [])

    const loadListItem = (lastId) => {
        dispatch({
            type: 'center/reqRecommenedRoom',
            payload: {
                isReplaced: !isMobile,
                lastId,
                excludeId: nowRoomId
            }
        })
    }

    const loadMore = () => {
        if (isLoadingList) {
            return
        }
        if (isMobile && !hasMore) {
            return
        }
        const lastId = roomList.length ? roomList[roomList.length - 1].id : null
        loadListItem(hasMore ? lastId : null)
    }

    const handleItemClick = (roomToken) => {
        dispatch({
            type: 'center/joinRoom',
            payload: {
                token: roomToken,
            }
        })
    }

    return <ScrollBar className={bindClass(styles.roomList, !isMobile && styles.normal)} onYReachEnd={isMobile ? loadMore : null}>
        <div className={bindClass(styles.list, !roomList.length && styles.noData)}>
            {
                roomList.length ? roomList.map(r => <RoomItemRender key={r.id} {...r} className={classes.roomItem} onClick={handleItemClick.bind(null, r.token)} />)
                    : <div>暂无数据</div>}
        </div>
        <div className={styles.bottom}>
            {
                !isMobile && <div>
                    <Button variant="contained" onClick={loadMore} color="primary" disabled={isLoadingList}>查看更多</Button>
                </div>
            }
            {
                isMobile && <React.Fragment>
                    {
                        !hasMore && <span>没有更多了...</span>
                    }
                    {
                        isLoadingList && <span>加载中...</span>
                    }
                </React.Fragment>

            }
        </div>

        {
            (isMobile && isInShow) && <div className={styles.floatButton} onClick={props.toPrevPage}>
                <Zoom in={true}>
                    <Fab><ArrowUp style={{color: styleConf.highLightColor}}/></Fab>
                </Zoom>
            </div>}
    </ScrollBar>
}

export default connect(({ center: { hasMoreRoomItem, roomList, userInfo }, loading }: ConnectState) => {
    return {
        nowRoomId: userInfo && userInfo.nowRoomId,
        hasMore: hasMoreRoomItem,
        isLoadingList: loading.effects['center/reqRecommenedRoom'],
        roomList: roomList,
    }
})(RoomList)
