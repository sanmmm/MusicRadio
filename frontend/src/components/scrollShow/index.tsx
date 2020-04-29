import React, {useRef, useEffect, useState} from 'react'
import bindClass from 'classnames';

import style from './style.less'

interface Props {
    children: React.ReactNode;
    show: boolean;
    transitionDuration: number;
    direction: ('right' | 'left' | 'both'); // 滚动展开方向
    className?: string;
    afterShow?: () => any;
    afterHide?: () => any;
}

export default React.memo<Props>((props) => {
    const {className, direction, children, show, transitionDuration = 0.5, afterShow, afterHide} = props
    const contentRef = useRef<HTMLSpanElement>(null)
    const [containerWidth, setContainerWidth] = useState(null)
    const [isInitial, setIsInitial] = useState(true)

    useEffect(() => {
        setIsInitial(false)
        requestAnimationFrame(() => {
            if (contentRef.current) {
                const eleRect = contentRef.current.getBoundingClientRect()   
                setContainerWidth(eleRect.width)
            }
        })
    }, [])

    useEffect(() => {
        let timer = null
        if (show) {
            timer = setTimeout(() => {
                afterShow && afterShow()
            }, transitionDuration * 1000)
        } else if (!isInitial) {
            timer = setTimeout(() => {
                afterHide && afterHide()
            }, transitionDuration * 1000)
        }
        return () => {
            if (timer) {
                clearTimeout(timer)
            }
        }
    }, [show])
    
    const isMeasure = !containerWidth
    const isShow = !isMeasure && show
    return <span  className={bindClass(style.container, className, {
        [style.rightDirection]: direction === 'right',
        [style.leftDirection]: direction === 'left',
        [style.bothDirection]: direction === 'both',
    })}  style={{
        width: containerWidth
    }}>
        <span className={bindClass(!isMeasure && style.content, isShow && style.show)}
            ref={contentRef}
            style={{
                transitionDuration: `${transitionDuration}s`,
                transitionTimingFunction: isShow ? 'ease-out' : 'ease-in',
            }}
        >
            {children}
        </span>
    </span>
})
