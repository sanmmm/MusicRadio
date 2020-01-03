import React, { useEffect, useState, useRef, useCallback } from 'react'
import bindClass from 'classnames'
import Scrollbar from 'react-perfect-scrollbar'
import DragBackend from 'react-dnd-html5-backend'
import { useDrag, useDrop, DropTargetMonitor, DndProvider } from 'react-dnd'
import { Checkbox } from '@material-ui/core'
import { withStyles } from '@material-ui/core/styles'

import styleConfig from '@/baseStyle.conf'
import useSyncState from '@/components/hooks/syncAccessState'
import styles from './style.less'

const CustomCheckbox = withStyles({
    root: {
        color: styleConfig.themeColor,
        '&$checked': {
            color: styleConfig.highLightColor,
        },
    },
    checked: {},
})(Checkbox)

interface Props<T = any> {
    loading?: boolean;
    className?: string;
    dataSource: T[];
    columns: {
        title?: string;
        dataKey?: keyof T;
        render?: (item: T, rowIndex: number) => React.ReactNode;
        width?: string | number;
    }[];
    rowKey: (item: T) => string;
    drag?: {
        onMove: (fromIndex: number, toIndex: number) => any;
    };
    rowClassName: (item: T, index: number) => string | string;
    rowSelection: {
        selectedRowKeys: string[];
        onChange: (keys: string[], items: T[]) => any;
    }
}

const ListRender = React.memo<Props>(function (props) {
    const { loading, dataSource, columns, rowKey, drag, rowSelection, rowClassName, className } = props

    const [getSyncState, setSyncState] = useSyncState({
        checkedKeys: new Set<string>(),
        dataSource: [],
        rowKey,
        onChange: rowSelection.onChange,
    })
    if (rowSelection) {
        setSyncState({
            ...getSyncState(),
            checkedKeys: new Set(rowSelection.selectedRowKeys),
            dataSource,
            rowKey,
            onChange: rowSelection.onChange,
        })
    }

    useEffect(() => {
        if (rowSelection) {
            const selecedKeySet = new Set(rowSelection.selectedRowKeys)
            const checkedKeys = [], checkedItems = []
            dataSource.forEach(item => {
                const key = rowKey(item)
                if (selecedKeySet.has(key)) {
                    checkedItems.push(item)
                    checkedKeys.push(key)
                }
            })
            if (checkedItems.length !== rowSelection.selectedRowKeys.length) {
                rowSelection.onChange(checkedKeys, checkedItems)
            }

        }
    }, [dataSource, dataSource.length])

    const handleItemCheck = useCallback((key: string, item, checked: boolean) => {
        const { checkedKeys, dataSource, rowKey, onChange } = getSyncState()
        checked ? checkedKeys.add(key) : checkedKeys.delete(key)
        const checkedItems = dataSource.filter(item => {
            const key = rowKey(item)
            if (checkedKeys.has(key)) {
                return true
            }
        })
        onChange && onChange(Array.from(checkedKeys), checkedItems)
    }, [])

    const handleCheckAll = useCallback((e) => {
        const toCheck = e.target.checked
        const { dataSource, rowKey, onChange } = getSyncState()
        let checkedKeys: string[] = [], checkedItms = []
        if (toCheck) {
            checkedKeys = dataSource.map(item => rowKey(item))
            checkedItms = dataSource
        }
        onChange && onChange(checkedKeys, checkedItms)
    }, [])

    const table = <div className={bindClass(styles.table, className)}>
        <div className={styles.tableContent}>
            <div className={styles.header}>
                <div className={styles.line}>
                    {
                        !!rowSelection &&
                        <CustomCheckbox disabled={!dataSource.length} 
                        checked={rowSelection && dataSource.length && rowSelection.selectedRowKeys.length === dataSource.length} onChange={handleCheckAll} />
                    }
                    {
                        columns.map((obj, index) => <div className={styles.cell} key={obj.dataKey ? obj.dataKey as string : index} style={{ width: obj.width }}>
                            {obj.title || ''}
                        </div>)}
                </div>
            </div>
            <Scrollbar className={styles.body}>
                {
                    dataSource.map((rowItem, index) => {
                        const key = rowKey(rowItem)
                        return <TableRow
                            key={key} keyName={key}
                            item={rowItem} index={index} columns={columns}
                            drag={drag} rowClassName={rowClassName}
                            checkAble={!!rowSelection}
                            checked={rowSelection.selectedRowKeys.includes(key)}
                            onCheck={handleItemCheck}
                        />
                    })
                }
                {
                    !dataSource.length &&
                    <div className={styles.noData}>
                        <span>暂无数据</span>
                    </div>
                }
            </Scrollbar>
        </div>
        {
            loading && <div className={styles.loading}>
                <span className={bindClass('iconfont icon-load', styles.icon)}></span>
            </div>}
    </div>
    return drag ? <DndProvider backend={DragBackend}>
        {table}
    </DndProvider> : table
})

export default ListRender


interface RowProps extends Pick<Props, 'columns' | 'rowClassName' | 'drag'> {
    item: any;
    index: number;
    keyName: string;
    checkAble?: boolean;
    checked?: boolean;
    onCheck?: (key: string, item: any, checked: boolean) => any;
}

const TableRow = React.memo<RowProps>(function (props) {
    const { columns, item, drag, rowClassName, index: rowIndex, checkAble = false, checked = false, onCheck, keyName } = props
    const handleCheck = useCallback((e) => {
        onCheck && onCheck(keyName, item, e.target.checked)
    }, [onCheck, keyName])

    const content = <React.Fragment>
        {
            checkAble && <CustomCheckbox checked={checked} onChange={handleCheck} />}
        {
            columns.map((obj, colIndex) => <div key={colIndex} className={styles.cell} style={{ width: obj.width }}>
                {obj.render ? obj.render(item, rowIndex) : (
                    obj.dataKey ? item[obj.dataKey] : null
                )}
            </div>)}
    </React.Fragment>
    const classStr = bindClass(typeof rowClassName === 'string' ? rowClassName : rowClassName(item, rowIndex), styles.line)
    const trProps = {
        className: classStr,
        onClick: () => { },
    }
    if (drag) {
        return <DragItemRender index={rowIndex} moveItem={drag.onMove} {...trProps}>
            {content}
        </DragItemRender>
    }
    return <div {...trProps}>
        {content}
    </div>
})


/**
 * 拖拽排序组件
 */
interface DragItem {
    index: number
    type: string
}

const DragItemRender = React.memo<{
    children: React.ReactNode;
    index: number;
    moveItem: (from: number, to: number) => any;
    style?: any;
    className?: string;
}>((props) => {
    const { index, moveItem, children, ...restProps } = props
    const { className, style = {} } = restProps
    const newStyle = {
        ...style,
        cursor: 'move'
    }
    const ref = useRef<HTMLTableRowElement>(null)
    const [dragingIndex, setDragingIndex] = useState(null)
    const [{ isOver }, drop] = useDrop({
        accept: 'dragItem',
        collect: (monitor) => {
            return {
                isOver: monitor.isOver()
            }
        },
        hover(dragItem: DragItem, monitor: DropTargetMonitor) {
            if (!ref.current) {
                return
            }

            const dragIndex = dragItem.index
            const hoverIndex = index
            if (dragIndex === hoverIndex) {
                return
            }
            setDragingIndex(dragIndex)
        },
        drop(dragItem: DragItem, monitor: DropTargetMonitor) {
            if (!ref.current) {
                return
            }
            setDragingIndex(null)
            const dragIndex = dragItem.index
            const hoverIndex = index

            if (dragIndex === hoverIndex) {
                return
            }
            moveItem(dragIndex, hoverIndex)
        },
    })
    const [{ isDragging }, drag] = useDrag({
        item: { type: 'dragItem', index },
        collect: (monitor: any) => ({
            isDragging: monitor.isDragging(),
        }),
    })
    drag(drop(ref))

    let appendClass = ''
    if (isOver && typeof dragingIndex === 'number') {
        appendClass = dragingIndex < index ? styles.bottomHighLight : styles.topHighLight
    }
    return <div {...restProps} ref={ref} className={bindClass(className, appendClass)} style={newStyle}>
        {children}
    </div>
})

