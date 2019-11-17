import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useDrag, useDrop, DropTargetMonitor } from 'react-dnd'
import { XYCoord } from 'dnd-core'
import { DndProvider } from 'react-dnd'
import HTML5Backend from 'react-dnd-html5-backend'
import { connect } from 'dva'
import { useMediaQuery } from 'react-responsive'
import ScrollBar from 'react-perfect-scrollbar'
import { Popover, Table, Checkbox } from 'antd'
import bindClass from 'classnames'

import { ConnectProps, ConnectState } from '@/models/connect'
import configs from '@/config'
import styles from './index.less'


interface MusicListProps extends ConnectProps {
    isEditMode: boolean; // 管理员模式
    musicList: PlayListItem[];
}

const formatMusicDuration = (t: number) => {
    const m = `0${Math.floor((t / 1000 / 60))}`.slice(-2)
    const s = `0${(Math.floor(t / 1000 % 60))}`.slice(-2)
    return `${m}:${s}`
}


const MusicList: React.FC<MusicListProps> = function (props) {
    const { isEditMode, musicList, dispatch } = props

    const isAdmin = true
    const isMobile = useMediaQuery({ query: configs.mobileMediaQuery })
    const [selectedIds, setSelectedIds] = useState([] as string[])
    const handleMoveItem = (fromIndex, toIndex) => {
        dispatch({
            type: 'playList/moveItem',
            payload: {
                from: fromIndex,
                to: toIndex
            }
        })
    }

    return <div className={styles.musicList}>
        {
            isEditMode && <div>可通过拖拽调整列表顺序</div>
        }
        <div className={styles.actionsBox}>
            <div><span className="iconfont icon-delete"></span><span>删除</span></div>
            <div><span className="iconfont icon-block"></span><span>屏蔽</span></div>
            <div><span className="iconfont icon-add"></span><span>添加</span></div>
            <div><span className="iconfont icon-clear"></span><span>全部删除</span></div>
        </div>
        <div className={bindClass(styles.tableHeader, isMobile && styles.mobile)}>
            <div className={styles.left}>
                <Checkbox checked={selectedIds.length === musicList.length}
                    onChange={(e) => {
                        const isChecked = e.target.checked
                        if (!isChecked) {
                            setSelectedIds([])
                        } else {
                            setSelectedIds(musicList.map(i => i.id))
                        }
                    }}
                />
            </div>
            <div className={styles.right}> 
            <div style={{width: '40%'}}>歌名</div>
            <div style={{width: '30%'}}>歌手</div>
            <div style={{width: '15%'}}>时长</div>
            <div style={{width: '15%'}}>操作</div>
            </div>
        </div>
        <Table
            columns={[
                {
                    dataIndex: 'name',
                    title: '歌曲',
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
                    render: (item: PlayListItem) => <Popover trigger={isMobile ? 'click' : 'hover'}
                        content={
                            <div className={styles.popoverActions}>
                                {
                                    isEditMode &&
                                    <div className={styles.item}><span className="iconfont icon-delete"></span><span>删除</span></div>
                                }
                                <div className={styles.item}><span className="iconfont icon-block"></span><span>{item.isBlock ? '取消屏蔽' : '屏蔽'}</span></div>
                            </div>}>
                        <span className="iconfont icon-menu"></span>
                    </Popover>
                }
            ]}
            dataSource={musicList} showHeader={false} pagination={false} rowKey={item => item.id}
            rowSelection={{
                selectedRowKeys: selectedIds,
                onChange: (ids: string[]) => setSelectedIds(ids)
            }}
            rowClassName={bindClass(styles.tableRow, isMobile && styles.mobile)}
        />
    </div>
}

export default connect(({ playList }: ConnectState) => {
    return {
        musicList: playList.playList,
        isEditMode: true
    }
})(MusicList)
