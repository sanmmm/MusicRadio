import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useDrag, useDrop, DropTargetMonitor } from 'react-dnd'
import { XYCoord } from 'dnd-core'
import { DndProvider } from 'react-dnd'
import TouchBackend from 'react-dnd-touch-backend'
import { useMediaQuery } from 'react-responsive'
import ScrollBar from 'react-perfect-scrollbar'
import { Popover, Table, Checkbox } from 'antd'
import { TableProps } from 'antd/lib/table'
import bindClass from 'classnames'

import configs from '@/config'
import styles from './index.less'

interface ListProps {
    actions: { icon: string; label: string, onClick: (e) => any }[];
    dataSource: any[];
    columns: TableProps<any>['columns'];
    rowSelection: TableProps<any>['rowSelection'];
    rowKey: TableProps<any>['rowKey'];
    rowClassName?: TableProps<any>['rowClassName'];
    onCloseSelection?: () => any;
    moveAble?: boolean;
    onMove?: (from: number, to: number) => any;
}

const ListLayout: React.FC<ListProps> = function (props) {
    const { dataSource, actions, columns, rowSelection, moveAble = false, rowKey } = props
    const { selectedRowKeys, onChange: selectItems } = rowSelection

    const isMobile = useMediaQuery({ query: configs.mobileMediaQuery })
    const isSelectAble = !!rowSelection
    const isAllSelected = selectedRowKeys.length === dataSource.length
    const handleMoveItem = useCallback((fromIndex, toIndex) => {
        props.onMove(fromIndex, toIndex)
    }, [props.onMove])
    const handleSelectAll = (_?: any) => {
        if (isAllSelected) {
            selectItems([], [])
        } else {
            selectItems([], [...dataSource])
        }
    }


    const tableProps: Partial<TableProps<any>> = {
        columns,
        dataSource,
        showHeader: false,
        pagination: false,
        rowKey,
        rowSelection,
        rowClassName: (record, index) => bindClass(styles.tableRow, isMobile && styles.mobile, props.rowClassName && props.rowClassName(record, index)),
        onRow: (record, index) => {
            const baseObj = {}
            if (moveAble) {
                Object.assign(baseObj, {
                    index,
                    item: record,
                    moveItem: handleMoveItem
                })
            }
            if (isMobile && isSelectAble) {
                Object.assign(baseObj, {
                    onClick: () => {
                        props.rowSelection.onSelect(record, null, [], null)
                    }
                })
            }
            return baseObj
        }
    }
    if (moveAble) {
        tableProps.components = {
            body: {
                row: Item,
            }
        }
    }
    return <div className={styles.listShowBox}>
        {
            moveAble && <div>可通过拖拽调整列表顺序</div>
        }
        <div className={bindClass(styles.actionsBox, isMobile ? styles.mobile : styles.normal)}>
            {actions.map((i, index) => <div key={index} onClick={i.onClick}>
                <span className={`iconfont icon-${i.icon}`}></span>
                <span>{i.label}</span>
            </div>)}
        </div>
        {
            (isMobile && isSelectAble) && <div className={styles.selectActionsBox}>
                <div onClick={props.onCloseSelection}><span>取消</span></div>
                <div onClick={handleSelectAll}><span>{isAllSelected ? '全部不选' : '全部选择'}</span></div>
            </div>}
        <div className={bindClass(styles.tableHeader, isMobile && styles.mobile)}>
            <div className={styles.left} style={{ visibility: (isSelectAble && !isMobile) ? 'unset' : 'hidden' }}>
                <Checkbox checked={isAllSelected}
                    onChange={handleSelectAll}
                />
            </div>
            <div className={styles.right}>
                {columns.map(c => <div style={{ width: c.width || 'auto' }}>{c.title}</div>)}
            </div>
        </div>
        <ScrollBar className={styles.tableBox}>
            <DndProvider backend={TouchBackend} options={{enableMouseEvents: true}}>
                <Table
                    {...tableProps}
                />
            </DndProvider>
        </ScrollBar>
    </div>
}

export default ListLayout


/**
 * 拖拽排序组件
 */
interface DragItem {
    index: number
    type: string
}

const Item: React.FC<{
    children: React.ReactNode
    item: any;
    index: number;
    moveItem: (from: number, to: number) => any;
    style?: any;
    className?: string;
}> = (props) => {
    const { item, index, moveItem, children, ...restProps } = props
    const { className, style = {} } = restProps
    const newStyle = {
        ...style,
        cursor: 'move'
    }
    const ref = useRef<HTMLTableRowElement>(null)
    const [appendClass, setAppendClass] = useState('')
    const [, drop] = useDrop({
        accept: 'dragItem',
        hover(dragItem: DragItem, monitor: DropTargetMonitor) {
            if (!ref.current) {
                return
            }
            if (!monitor.isOver()) {
                setAppendClass('')
            }
            const dragIndex = dragItem.index
            const hoverIndex = index
            console.log('hover', dragIndex, hoverIndex)
            if (dragIndex === hoverIndex) {
                return
            }
            let newAppendClass = appendClass
            // const clientOffset = monitor.getClientOffset()
            // const hoverBoundingRect = ref.current.getBoundingClientRect()
            // const hoverTop = hoverBoundingRect.top + 5, hoverBottom = hoverBoundingRect.bottom - 5
            // if (clientOffset.y > hoverTop && clientOffset.y < hoverBottom) {
            //     newAppendClass = dragIndex < hoverIndex ? styles.bottomHighLight : styles.topHighLight
            // } else {
            //     newAppendClass = ''
            // }
            // if (newAppendClass !== appendClass) {
            // }
            newAppendClass = dragIndex < hoverIndex ? styles.bottomHighLight : styles.topHighLight
            setAppendClass(newAppendClass)
        },
        drop(dragItem: DragItem, monitor: DropTargetMonitor) {
            setAppendClass('')
            if (!ref.current) {
                return
            }
            const dragIndex = dragItem.index
            const hoverIndex = index
            console.log(dragIndex, hoverIndex, 'darg')

            if (dragIndex === hoverIndex) {
                return
            }
            // const hoverBoundingRect = ref.current!.getBoundingClientRect()
            // const hoverMiddleY =
            //     (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2
            // const clientOffset = monitor.getClientOffset()
            // const hoverClientY = (clientOffset as XYCoord).y - hoverBoundingRect.top

            // // Dragging downwards
            // if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
            //     return
            // }
            // // Dragging upwards
            // if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
            //     return
            // }
            moveItem(dragIndex, hoverIndex)
            dragItem.index = hoverIndex
        },
    })

    const [{ isDragging }, drag] = useDrag({
        item: { type: 'dragItem', index },
        collect: (monitor: any) => ({
            isDragging: monitor.isDragging(),
        }),
    })
    drag(drop(ref))
    return <tr {...restProps} ref={ref} className={bindClass(className, appendClass)} style={newStyle}>
        {children}
    </tr>
}
