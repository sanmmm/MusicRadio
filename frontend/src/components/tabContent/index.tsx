import React, { useState } from 'react'
import bindClass from 'classnames'

import styles from './style.less'

interface Props {
    activeKey: string | number;
    children: React.ReactElement[]
}

const decimalToPercent = (num: number) => `${num.toFixed(2).slice(2)}%`

interface TabContent extends React.FC<Props>{
    Item: typeof TabContentItem
}

const TabContent: TabContent = function (props) {
    const {activeKey, children} = props
    const childLength = React.Children.count(children)
    const childWidthRatio = childLength ? 1 / childLength : 0
    let offsetIndex = 0
    React.Children.forEach(children, (child, index) => {
        const {key, props: {style = {}}} = child
        if (key === activeKey) {
            offsetIndex = index
        }
    })
    return <div className={styles.tabContentBox}>
        <div className={styles.container} style={{
                transform: `translateX(-${decimalToPercent(childWidthRatio * offsetIndex)})`,
                width: `${childLength * 100}%`
                }}>
            {
                children
            }
        </div>
    </div>
}

const TabContentItem: React.FC<{
    key: string;
    children: React.ReactNode;
}> = (props) => {
    return <div className={styles.tabContentItem}>
        {props.children}
    </div>
}
TabContent.Item = TabContentItem

export default TabContent

