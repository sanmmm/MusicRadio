import React, { useEffect, useState } from 'react'
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
    index?: number,
    time: number,
    type: LyricItemTypes,
    content: string
}


const LyricBox: React.FC<LyricBoxProps> = function (props) {

    const [state, setState] = useState({
        focusItemIndex: -2
    } as {
        focusItemIndex: number
    })
    const [freshLyricItems, setLyricItems] = useState([] as LyricItem[])

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
                content
            }
        }).filter(i => !!i).map((item, i) => ({
            ...item,
            index: i
        }))
        setLyricItems(items)
    }, [props.id])

    useEffect(() => {
        const nowFocusItemIndex = freshLyricItems.findIndex((item, index) => {
            if (item.time <= props.nowTime) {
                const nextItem = freshLyricItems[index + 1]
                if (!nextItem || props.nowTime < nextItem.time) {
                    return true
                }
            }
            return false
        })
        if (nowFocusItemIndex === state.focusItemIndex) {
            return
        }
        setState({
            ...state,
            focusItemIndex: nowFocusItemIndex
        })
    }, [freshLyricItems, props.nowTime])

    const lyricOffsetValue = freshLyricItems.length && (state.focusItemIndex / freshLyricItems.length) * 100
    return <div className={styles.lyricBox}>
        {
            freshLyricItems.length ?
                <div style={{ transform: `translate(0, -${lyricOffsetValue}%)` }} className={styles.itemsBox}>
                    {
                        freshLyricItems.map(item => <div key={item.index} className={bindClass(styles.item, item.index === state.focusItemIndex && styles.focus)}>
                            {item.content}
                        </div>)}
                </div> :
                <div className={styles.noLrc}>   
                    暂无字幕
                </div>
        }

    </div>
}

export default LyricBox
