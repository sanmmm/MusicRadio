import React from 'react'
import {Icon, IconProps} from '@material-ui/core'
import bindClass from 'classnames'

import styles from './style.less'

interface props extends IconProps{
    className?: string;
    children: React.ReactText;
}

export default function CustomIcon (props: props) {
    const {className, children: iconType} = props
    const newProps = {
        ...props,
        className: undefined,
        children: undefined,
        style: {
            fontSize: '1rem',
            overflow: 'visible',
            ...(props.style || {})
        }
    }
    return <Icon {...newProps} className={bindClass('iconfont', `icon-${iconType}`, className)} >
    </Icon>
}
