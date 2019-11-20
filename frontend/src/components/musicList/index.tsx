import React, { useEffect, useState, useMemo } from 'react'
import { useDrag, useDrop, DropTargetMonitor } from 'react-dnd'
import { XYCoord } from 'dnd-core'
import { DndProvider } from 'react-dnd'
import HTML5Backend from 'react-dnd-html5-backend'
import { connect } from 'dva'
import { useMediaQuery } from 'react-responsive'
import ScrollBar from 'react-perfect-scrollbar'
import { Popover, Table, Checkbox } from 'antd'
import { PopoverProps } from 'antd/lib/popover'
import bindClass from 'classnames'

import { PlayListItem } from '@/typeConfig'
import { ConnectProps, ConnectState } from '@/models/connect'
import ListShow from './list'
import configs from '@/config'
import styles from './index.less'


const formatMusicDuration = (t: number) => {
    const m = `0${Math.floor((t / 1000 / 60))}`.slice(-2)
    const s = `0${(Math.floor(t / 1000 % 60))}`.slice(-2)
    return `${m}:${s}`
}

interface MusicListProps extends ConnectProps {
    isEditMode: boolean; // 管理员模式
    musicList: PlayListItem[];
}

enum BlockActionBtnType {
    showBlock = 1,
    showUnblock = 2,
}

const radioSignalAnimationDuration = 2 // s
const getRandomDelayValue = () => {
    return [1, 2, 3, 4].map(_ => Math.random() * radioSignalAnimationDuration)
}

const MusicList: React.FC<MusicListProps> = function (props) {
    const { isEditMode, musicList, dispatch } = props

    const [selectedItems, setSelectedItem] = useState([] as PlayListItem[])
    const [randomArr, _] = useState(getRandomDelayValue())
    const isMobile = useMediaQuery({ query: configs.mobileMediaQuery })

    const handleMoveItem = (fromIndex, toIndex) => {
        dispatch({
            type: 'playList/moveItem',
            payload: {
                from: fromIndex,
                to: toIndex
            }
        })
    }

    const selectedIds = useMemo(() => {
        return selectedItems.map(i => i.id)
    }, [selectedItems])

    const blockBtnType: BlockActionBtnType = useMemo(() => {
        if (!selectedItems.length) {
            return null
        }
        let type = null
        let initBlockStatus = selectedItems[0].isBlock
        const flag = selectedItems.every((item => item.isBlock === initBlockStatus))
        if (flag) {
            type = selectedItems[0].isBlock ? BlockActionBtnType.showUnblock : BlockActionBtnType.showBlock
        }
        return type
    }, [selectedItems])

    const actions = [
        {
            icon: 'add',
            label: '添加',
            onClick: () => { }
        },
        {
            icon: 'delete',
            label: '删除',
            onClick: () => { }
        },
        {
            icon: 'clear',
            label: '全部删除',
            onClick: () => { }
        },
    ]
    if (blockBtnType) {
        actions.push({
            icon: 'block',
            label: blockBtnType === BlockActionBtnType.showBlock ? '屏蔽' : '取消屏蔽',
            onClick: () => { }
        })
    }

    return <ListShow
        actions={actions}
        moveAble={true}
        onMove={handleMoveItem}
        columns={[
            {
                title: '歌曲',
                render: (_, item, index) => <div className={styles.musicNameTd}>
                    <span>{item.name}</span>
                    {
                        item.isBlock && <span className="iconfont icon-block"></span>
                    }
                    {
                        index === 0 && <span className={styles.radioRandomSignalIcon}>
                            {randomArr.map(t => <span
                                key={t}
                                style={{
                                    animationDelay: `${t}s`,
                                    animationDuration: `${radioSignalAnimationDuration}s`,
                                }}
                            ></span>)}
                        </span>}
                </div>,
                width: '40%'
            },
            {
                dataIndex: 'artist',
                title: '歌手',
                width: '30%'
            },
            {
                render: (item) => formatMusicDuration(item.duration),
                title: '时长',
                width: '15%'
            },
            {
                width: '15%',
                title: '',
                render: (item: PlayListItem) => <CustomPopover trigger={isMobile ? 'click' : 'hover'}
                    content={
                        <div className={styles.popoverActions}>
                            {
                                isEditMode &&
                                <div className={styles.item}><span className="iconfont icon-delete"></span><span>删除</span></div>
                            }
                            <div className={styles.item}><span className="iconfont icon-block"></span><span>{item.isBlock ? '取消屏蔽' : '屏蔽'}</span></div>
                        </div>}>
                    <span className="iconfont icon-menu"></span>
                </CustomPopover>
            }
        ]}
        dataSource={musicList}
        rowSelection={{
            selectedRowKeys: selectedIds,
            onSelect: (item) => {
                const findIndex = selectedItems.findIndex(i => i === item)
                if (findIndex > -1) {
                    selectedItems.splice(findIndex, 1)
                } else {
                    selectedItems.push(item)
                }
                setSelectedItem([...selectedItems])
            },
            onChange: (_, items: any[]) => setSelectedItem(items),
        }}
        rowKey={item => item.id}
        rowClassName={(_, index) => index === 0 && styles.focusMusicRow}
    />
}

export default connect(({ playList }: ConnectState) => {
    return {
        musicList: playList.playList,
        isEditMode: true
    }
})(MusicList)


const CustomPopover: React.FC<PopoverProps> = function (props) {
    const [isVisible, setVisible] = useState(false)
    const { content } = props
    return <Popover visible={isVisible} onVisibleChange={visible => setVisible(visible)} content={<div onClick={e => {
        e.stopPropagation()
        setVisible(false)
    }}>
        {content}
    </div>}>
        <div onClick={e => e.stopPropagation()} style={{ display: 'inline-block' }}>
            {props.children}
        </div>
    </Popover>
}
