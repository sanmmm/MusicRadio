import React, { useEffect, useState, useRef } from 'react'
import bindClass from 'classnames'

import styles from './index.less'

interface LyricBoxProps {
    id: string,
    lyric: string,
    nowTime: number,
    showItemCount: number
}

enum LyricItemTypes {
    other,
    content
}

interface LyricItem {
    time: number,
    type: LyricItemTypes,
    content: string,
    lineHeight?: number,
}

const itemHeight = '2em'

const calcOffset = (cursorIndex: number, items: LyricItem[]) => {
    let offset = 0
    items.some((item, index) => {
        if (index < cursorIndex) {
            offset += item.lineHeight
            return false
        }
        return true
    })
    return offset
}

const LyricBox: React.FC<LyricBoxProps> = React.memo(function (props) {
    const boxRef = useRef<HTMLDivElement>(null)
    const [focusItemIndex, setFocusItemIndex] = useState(-2 as number)
    const [freshLyricItems, setLyricItems] = useState([] as LyricItem[])
    const [needCalcItemsLineHeight, setNeedCalcItemLineHeight] = useState(false)

    useEffect(() => {
        const { lyric = '' } = props
        const items: LyricItem[] = lyric.split('\n').map(s => {
            const parsed = /^\[(.*)\](.*)$/.exec(s)
            if (!parsed) {
                return
            }
            const [, pre = '', content = ''] = parsed
            // const isValidLabel = ['al', 'ti', 'ar'].some(type => label.startsWith(type)) TODO 支持歌曲标签信息
            if (!content.trim()) {
                return
            }
            const timeUnitArr = pre.split(':').filter(i => !!i)
            const time = timeUnitArr.reduce((time, v, i) => {
                const scale = [60, 1, 0.01][i]
                return time + Number(v) * scale
            }, 0)
            return {
                type: LyricItemTypes.content,
                time,
                content,
            }
        }).filter(i => !!i)
        setLyricItems(items)
        setNeedCalcItemLineHeight(true)
    }, [props.id, props.lyric])

    useEffect(() => {
        if (boxRef.current && needCalcItemsLineHeight) {
            const nodeList = boxRef.current.querySelectorAll(`.${styles.item}`)
            nodeList.forEach((node, index) => {
                const rect = node.getBoundingClientRect()
                const lyricItem = freshLyricItems[index]
                const eleHeight = rect.height || rect.bottom - rect.top
                lyricItem && (lyricItem.lineHeight = eleHeight)
            })
            setNeedCalcItemLineHeight(false)
        }
    }, [needCalcItemsLineHeight])

    useEffect(() => {
        const nowFocusItemIndex = freshLyricItems.findIndex((item, index) => {
            if (props.nowTime + 0.5 > item.time) {
                const nextItem = freshLyricItems[index + 1]
                if (!nextItem || (props.nowTime + 0.5) < nextItem.time) {
                    return true
                }
            }
            return false
        })
        setFocusItemIndex(nowFocusItemIndex)
    }, [freshLyricItems, props.nowTime])

    const lyricOffsetValue = freshLyricItems.length && calcOffset(focusItemIndex, freshLyricItems)
    return <div className={styles.lyricBox} 
        style={{height: `calc(${props.showItemCount || 2} * ${itemHeight})`}}
        ref={boxRef}
     >
        {
            freshLyricItems.length ?
                <div style={{ transform: `translate(0, -${lyricOffsetValue}px)`, lineHeight: itemHeight }} className={styles.itemsBox}>
                    {
                        freshLyricItems.map((item, index) => <div key={index} className={bindClass(styles.item, index === focusItemIndex && styles.focus)}>
                            {item.content}
                        </div>)}
                </div> :
                <div className={styles.noLrc}>   
                    暂无字幕
                </div>
        }

    </div>
})

export default LyricBox
