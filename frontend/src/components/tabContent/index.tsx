import React, { useState } from 'react'
import bindClass from 'classnames'

import styles from './style.less'

interface Props {
    activeKey: string | number;
    children: React.ReactNode;
}

const decimalToPercent = (num: number) => `${(num * 100).toFixed(2)}%`

type TabContent = React.FC<Props> & {
    Item: typeof TabContentItem 
}

const TabContent: TabContent = React.memo<Props>(function (props) {
    const {activeKey, children} = props
    let childLength = 0, offsetIndex = 0
    const renderChildArr: React.ReactElement[] = []
    React.Children.forEach(children, (child: React.ReactElement, index) => {
        if (!child) {
            return
        }
        childLength ++
        renderChildArr.push(child)
        const {key} = child
        if (key === activeKey) {
            offsetIndex = index
        }
    })
    const childWidthRatio = childLength ? 1 / childLength : 0
    return <div className={styles.tabContentBox}>
        <div className={styles.container} style={{
                transform: `translateX(-${decimalToPercent(childWidthRatio * offsetIndex)})`,
                width: `${childLength * 100}%`
                }}>
            {
                renderChildArr.map(child => React.cloneElement(child, {
                    width: child.props.width || decimalToPercent(childWidthRatio),
                }))
            }
        </div>
    </div>
}) as any

const TabContentItem: React.FC<{
    key: string;
    children: React.ReactNode;
    width?: string | number;
}> = (props) => {
    return <div className={styles.tabContentItem} style={{width: props.width}}>
        {props.children}
    </div>
}

TabContent.Item = TabContentItem

export default TabContent

