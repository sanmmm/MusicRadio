import React, { useEffect, useState, useMemo } from 'react'
import { connect } from 'dva'
import { useMediaQuery } from 'react-responsive'
import { Popover } from '@material-ui/core'
import bindClass from 'classnames'

import List from '@/components/list'
import SignalIcon from '@/components/signalIcon'
import { PlayListItem } from '@/typeConfig'
import { ConnectProps, ConnectState } from '@/models/connect'
import configs from '@/config'
import styles from './index.less'


const formatMusicDuration = (t: number) => {
    const m = `0${Math.floor((t / 60))}`.slice(-2)
    const s = `0${(Math.floor(t % 60))}`.slice(-2)
    return `${m}:${s}`
}

interface MusicListProps extends ConnectProps {
    isRoomAdmin: boolean; // 管理员模式
    nowRoomId: string;
    musicList: PlayListItem[];
    actionPending: boolean;
    blockPlayItems: string[];
}

enum BlockActionBtnType {
    showBlock = 1,
    showUnblock = 2,
}

const MusicList: React.FC<MusicListProps> = function (props) {
    const { isRoomAdmin, musicList, nowRoomId, dispatch, actionPending, blockPlayItems } = props

    const [selectedItems, setSelectedItem] = useState([] as PlayListItem[])
    const isMobile = useMediaQuery({ query: configs.mobileMediaQuery })

    const selectedIds = useMemo(() => {
        return selectedItems.map(i => i.id)
    }, [selectedItems])

    const blockItemIdSet = useMemo(() => {
        return new Set(blockPlayItems || [])
    }, [blockPlayItems])

    const blockBtnType: BlockActionBtnType = useMemo(() => {
        if (!selectedItems.length) {
            return null
        }
        const getBlockStatus = (item: PlayListItem) => blockItemIdSet.has(item.id)
        let type = null
        let initBlockStatus = getBlockStatus(selectedItems[0])
        const flag = selectedItems.every((item => getBlockStatus(item) === initBlockStatus))
        if (flag) {
            type = initBlockStatus === true ? BlockActionBtnType.showUnblock : BlockActionBtnType.showBlock
        }
        return type
    }, [selectedItems, blockPlayItems])

    const handleMoveItem = (fromIndex, toIndex) => {
        dispatch({
            type: 'playList/movePlayListItem',
            payload: {
                roomId: nowRoomId,
                fromIndex,
                toIndex
            }
        })
    }

    const handleDeleteItems = (ids: string[]) => {
        dispatch({
            type: 'playList/deletePlayListItem',
            payload: {
                roomId: nowRoomId,
                ids
            }
        })
    }

    const handleBlockOrUnBlockItem = (item: PlayListItem) => {
        const actionType = blockItemIdSet.has(item.id) ? 'playList/unblockPlayListItems' : 'playList/blockPlayListItems'
        dispatch({
            type: actionType,
            payload: {
                ids: [item.id]
            }
        })
    }

    let actions: {
        icon: string;
        label: string;
        onClick: (...args: any) => any;
    }[] = [] 
    if (isRoomAdmin) {
        actions = actions.concat([
            {
                icon: 'delete',
                label: '删除',
                onClick: () => {
                    const ids = selectedIds
                    handleDeleteItems(ids)
                }
            },
            {
                icon: 'clear',
                label: '全部删除',
                onClick: () => {
                    handleDeleteItems(musicList.map(item => item.id))
                }
            },
        ])
    }
    if (blockBtnType) {
        actions.push({
            icon: 'block',
            label: blockBtnType === BlockActionBtnType.showBlock ? '屏蔽' : '取消屏蔽',
            onClick: () => { 
                const actionType = blockBtnType === BlockActionBtnType.showBlock ? 'playList/blockPlayListItems' : 'playList/unblockPlayListItems'
                dispatch({
                    type: actionType,
                    payload: {
                        ids: selectedIds
                    }
                }).then(success => {
                    if (success) {
                        setSelectedItem([])
                    }
                })
            }
        })
    }

    return <div className={styles.musicList}>
        {
            (!isMobile && isRoomAdmin) && <div>可通过拖拽调整列表顺序</div>
        }
        <div className={bindClass(styles.actionsBox, isMobile ? styles.mobile : styles.normal)}>
            {actions.map((i, index) => <div key={index} onClick={i.onClick}>
                <span className={`iconfont icon-${i.icon}`}></span>
                <span>{i.label}</span>
            </div>)}
        </div>
        <List
            loading={actionPending}
            className={styles.tableContainer}
            drag={isRoomAdmin ? {
                onMove: handleMoveItem
            } : null}
            columns={[
                {
                    title: '歌曲',
                    render: (item: PlayListItem, index) => <div className={styles.musicNameCell}>
                        <span className={styles.name}>{item.name}</span>
                        {
                            blockItemIdSet.has(item.id) ? <span className="iconfont icon-block"></span> :
                            index === 0 && <SignalIcon />
                        }
                    </div>,
                    width: '40%'
                },
                {
                    dataKey: 'artist',
                    title: '歌手',
                    width: '25%'
                },
                {
                    render: (item) => formatMusicDuration(item.duration),
                    title: '时长',
                    width: '20%'
                },
                {
                    width: '15%',
                    title: '',
                    render: (item: PlayListItem) => <CustomPopover
                        trigger={
                            <div className="iconfont icon-menu" ></div>
                        }>
                        <div className={styles.popoverActions}>
                            {
                                isRoomAdmin &&
                                <div className={styles.item} onClick={_ => handleDeleteItems([item.id])}><span className="iconfont icon-delete"></span><span>删除</span></div>
                            }
                            <div className={styles.item} onClick={handleBlockOrUnBlockItem.bind(null, item)}><span className="iconfont icon-block"></span><span>{blockItemIdSet.has(item.id) ? '取消屏蔽' : '屏蔽'}</span></div>
                        </div>
                    </CustomPopover>
                }
            ]}
            dataSource={musicList}
            rowSelection={{
                selectedRowKeys: selectedIds,
                onChange: (keys, items: any[]) => setSelectedItem(items),
            }}
            rowKey={item => item.id}
            rowClassName={(_, index) => index === 0 && styles.focusMusicRow}
        />
    </div>
}

export default connect(({ playList, center: { nowRoomInfo, userInfo, blockPlayItems }, loading }: ConnectState) => {
    const actionPending = ['movePlayListItem', 'deletePlayListItem', 'blockPlayListItems', 'unblockPlayListItems'].some(s => loading.effects[`playList/${s}`])
    return {
        nowRoomId: nowRoomInfo && nowRoomInfo.id,
        musicList: playList.playList,
        isRoomAdmin: userInfo && (userInfo.isSuperAdmin || userInfo.isRoomCreator),
        actionPending,
        blockPlayItems,
    }
})(MusicList)

interface CustomPopoverProps {
    trigger: React.ReactNode,
    children: React.ReactNode
}

const CustomPopover: React.FC<CustomPopoverProps> = function (props) {
    const [anchorEle, setAnchorEle] = useState(null as Element)
    const { children, trigger } = props
    return <div>
        <div onClick={e => setAnchorEle(e.target as Element)} style={{ cursor: 'pointer' }}>
            {trigger}
        </div>
        <Popover open={Boolean(anchorEle)} anchorEl={anchorEle} onClose={_ => setAnchorEle(null)} onClick={e => {
            e.stopPropagation()
            setAnchorEle(null)
        }}>
            {children}
        </Popover>
    </div>
}
