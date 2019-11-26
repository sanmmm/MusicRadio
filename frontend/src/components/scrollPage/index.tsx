import React, { useState, useRef, useEffect, useMemo, useImperativeHandle, forwardRef } from 'react'
import bindclass from 'classnames'
import { useSwipeable, Swipeable } from 'react-swipeable'

import useWindowHeightListen from '@/components/windowHeightListen'
import styleConfigs from '@/baseStyle.conf'
import { throttle } from '@/utils'
import styles from './style.less'

interface Props {
    children: React.ReactElement<ItemProps, typeof ScrollPageItem>[];
    onPageChange?: (page: number) => any;
}
const ScrollWrapper: React.FC<Props> = function (props, ref) {
    const [focusPageIndex, setFocusPageIndex] = useState(0)
    const [pageHeight, setPageHeight] = useState(0)
    const windowHeight = useWindowHeightListen()
    const containerRef = useRef<HTMLDivElement>(null)
    const boxRef = useRef<HTMLDivElement>(null)
    useEffect(() => {
        const client = boxRef.current.getBoundingClientRect()
        setPageHeight(client.height)
    }, [])

    useEffect(() => {
        document.body.addEventListener('touchmove', function (e) {
            e.preventDefault(); //阻止默认的处理方式(阻止微信浏览器下拉滑动的效果)
        }, { passive: false });
    }, [])

    useEffect(() => {
        props.onPageChange && props.onPageChange(focusPageIndex)
    }, [focusPageIndex])

    const toPreviousPage = useMemo(() => {
        return throttle((e) => {
            setFocusPageIndex((prevValue) => {
                if (prevValue === 0) {
                    return prevValue
                }
                return prevValue - 1
            })
        }, 900)
    }, [])
    const toNextPage = useMemo(() => {
        return throttle((e) => {
            setFocusPageIndex((prevValue) => {
                const childCount = React.Children.count(props.children)
                if (prevValue === childCount - 1) {
                    return prevValue
                }
                return prevValue + 1
            })
        }, 900)
    }, [])
    const handlers = useSwipeable({ onSwipedUp: toNextPage, onSwipedDown: toPreviousPage })
    useImperativeHandle(ref, () => {
        return {
            toPreviousPage,
            toNextPage,
        }
    })
    return <div {...handlers}>
        <div ref={boxRef} className={styles.scrollOuterBox} 
            style={{
                height: windowHeight
            }}
            onWheel={e => {
                const { deltaY } = e
                if (deltaY < 0) {
                    toPreviousPage()
                } else {
                    toNextPage()
                }
            }}>
            <div ref={containerRef} className={styles.scrollContainer}
                style={{ top: `${-1 * pageHeight * focusPageIndex}px` }}
            >
                {
                    React.Children.map(props.children, (child, index) => {
                        return <div key={index} 
                            style={{
                                height: `calc(${windowHeight}px - ${styleConfigs.headerHeight})`,
                                marginTop: styleConfigs.headerHeight,
                            }}
                            className={bindclass(styles.scrollPageContainer, focusPageIndex === index && styles.focus)}
                            >
                            {
                                React.cloneElement(child, {
                                    isShow: focusPageIndex === index
                                })
                            }
                        </div>
                    })
                }
            </div>
        </div>
    </div>
}

export default forwardRef(ScrollWrapper)


interface ItemProps {
    isShow?: boolean;
    children: React.ReactNode | ((isShow: boolean) => React.ReactNode)
}

export const ScrollPageItem: React.FC<ItemProps> = ({ children, isShow }) => {
    return typeof children === 'function' ? (children as Function)(isShow) : children
}
