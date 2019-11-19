import React from 'react'
import bindClass from 'classnames'
import { Slider } from 'antd'

import Lyric from './lyric'
import styles from './index.less'

interface PlayerProps {
    name: string;
    artist: string;
    src: string;
    totalTime: number;
    comment: {
        nickName: string;
        avatarUrl: string;
        content: string;
        userId: number;
    };
    lrc?: string;
    pic?: string;
    simpleMode?: boolean // 简单模式，只能听，不能操作
}

interface PlayerState {
    timeRatio: number;
    volumeRatio: number;
    isDragCursor: boolean;
    isPaused: boolean;
    commentFontSize?: number;
}

const signalIconAnimationDuration = 2
export default class Player extends React.Component<PlayerProps, PlayerState> {
    audioEle: HTMLAudioElement
    progressEle: HTMLDivElement
    lastVolumeRatioValue: number
    signalIconData: string[]
    commentTopEle: HTMLDivElement
    commentBotttomEle: HTMLDivElement
    commentLineHeight: number // em
    commentBoxEle: HTMLDivElement
    constructor(props) {
        super(props)
        this.state = {
            timeRatio: 0,
            volumeRatio: 0.4,
            isDragCursor: false,
            isPaused: true,
        }
        this.commentLineHeight = 1.8
        this._handleMouseMove = this._handleMouseMove.bind(this)
        this._handleMouseUp = this._handleMouseUp.bind(this)
        this.signalIconData = [1, 2, 3, 4].map(i => `${(signalIconAnimationDuration * Math.random()).toFixed(2)}s`)
    }

    componentDidMount() {
        this._calcCommentFontSize(this.props)
    }

    componentWillReceiveProps(nexProps) {
        if (nexProps.comment !== this.props.comment) {
            this._calcCommentFontSize(nexProps)
        }
    }

    _setVolume(ratio: number) {
        this.audioEle.volume = ratio
    }

    _setTime(ratio: number) {
        this.audioEle.currentTime = this.props.totalTime * ratio
    }

    _calcTimeRatio(xPostion) {
        const { left, right, width } = this.progressEle.getBoundingClientRect()
        let ratio
        if (xPostion <= left) {
            ratio = 0
        } else if (xPostion >= right) {
            ratio = 1
        } else {
            ratio = (xPostion - left) / width
        }
        return ratio
    }

    _handleMouseMove(e) {
        if (this.state.isDragCursor) {
            const { pageX, screenY } = e
            const ratio = this._calcTimeRatio(pageX)
            console.log(ratio)
            this._setTime(ratio)
            this.setState({
                timeRatio: ratio
            })
        }
    }

    _handleMouseUp(e) { // end
        e.stopPropagation()
        console.log('up', e)
        if (this.state.isDragCursor) {
            console.log('end')
            document.removeEventListener('mousemove', this._handleMouseMove)
            document.removeEventListener('mouseup', this._handleMouseUp)
            const ratio = this._calcTimeRatio(e.pageX)
            this.setState({
                isDragCursor: false,
                timeRatio: ratio
            })
            this._setTime(ratio)
            !this.state.isPaused && this.audioEle.play()
        }
    }

    _startDragCursor(e) {  // start 
        console.log('start', e)
        e.stopPropagation()
        document.addEventListener('mousemove', this._handleMouseMove)
        document.addEventListener('mouseup', this._handleMouseUp)
        this.setState({
            isDragCursor: true,
        })
        this.audioEle.pause()
    }

    _calcCommentFontSize(props: PlayerProps) {
        const { comment } = props
        if (!comment || !comment.content) {
            return
        }
        const fontSizeSet = [18, 16, 14, 12]
        const topClient = this.commentTopEle.getBoundingClientRect()
        const bottomClient = this.commentBotttomEle.getBoundingClientRect()
        const boxClient = this.commentBoxEle.getBoundingClientRect()
        const maxContentHeight = boxClient.height - bottomClient.height - topClient.height
        const maxContentwidth = boxClient.width
        const averageFontSize = Math.sqrt((maxContentwidth * (maxContentHeight / this.commentLineHeight)) / comment.content.length)
        const selectedFontSize = fontSizeSet.find(i => averageFontSize >= i)
        this.setState({
            commentFontSize: selectedFontSize
        })
    }

    render() {
        const { src, lrc, totalTime, pic, name, artist, comment } = this.props
        const { timeRatio, volumeRatio, isPaused, commentFontSize } = this.state
        const curcorSize = 8
        const progressLineHeight = 2
        return <div className={styles.playerBox}>
            <div className={styles.mask}>
            </div>
            <div className={styles.playerBackground}>
            </div>
            <div className={styles.left}>
                <div className={bindClass(!isPaused && styles.rotate, styles.picBox)}>
                    {pic ? <img src={pic} /> : <div className={styles.noPic}>暂无封面</div>}
                </div>
                <Lyric lyric={this.props.lrc} nowTime={timeRatio * totalTime} showItemCount={4} id="id" />
            </div>
            <audio src={src}
                ref={ele => this.audioEle = ele}
                onTimeUpdate={event => {
                    console.log(this.audioEle.currentTime)
                    this.setState({
                        timeRatio: this.audioEle.currentTime / totalTime
                    })
                }}
                onEnded={_ => {
                    this.setState({
                        timeRatio: 1,
                        isPaused: true
                    })
                }}
            ></audio>
            <div className={styles.main}>
                <div className={styles.commentBox}>
                    {
                        !!comment ? <div className={styles.showData} ref={ele => this.commentBoxEle = ele}
                        >
                            <div className={styles.top} ref={ele => this.commentTopEle = ele}><span className="iconfont icon-quoteleft"></span></div>
                            {
                                !!commentFontSize && <p
                                    style={{ fontSize: commentFontSize, lineHeight: `${this.commentLineHeight}em` }}
                                    className={styles.content}>{comment.content}</p>
                            }
                            <div className={styles.bottom} ref={ele => this.commentBotttomEle = ele}>
                                <img src={comment.avatarUrl} />
                                <span className={styles.nickName} title={`点击查看${comment.nickName}的主页`}
                                    onClick={_ => window.open(`https://music.163.com/#/user/home?id=${comment.userId}`)}
                                >{comment.nickName}</span>
                            </div>
                        </div> :
                            <div className={styles.noData}>
                                暂无热评
                        </div>}
                </div>
                <div className={styles.controlBox}>
                    <div className={styles.left}>
                        <div className={styles.musicBaseInfo}>
                            <div className={bindClass(styles.signalIcon, this.state.isPaused && styles.paused)}>
                                {
                                    this.signalIconData.map(delay => <div style={{ animationDelay: delay, animationDuration: `${signalIconAnimationDuration}s` }}></div>)}
                            </div>
                            <span className={styles.content}>{name} - {artist}</span>
                        </div>
                        <div className={styles.progressOuter} onMouseDown={this._startDragCursor.bind(this)} >
                            <div className={styles.progress} ref={ele => this.progressEle = ele} style={{ height: progressLineHeight }} >
                                <div className={styles.base} >
                                </div>
                                <div className={styles.past} style={{ width: `${timeRatio * 100}%` }}>
                                </div>
                                <div className={styles.curcor}
                                    style={{
                                        width: curcorSize, height: curcorSize,
                                        left: `calc(${timeRatio * 100}% - ${curcorSize / 2}px)`, top: (progressLineHeight - curcorSize) / 2
                                    }}
                                    onMouseDown={this._startDragCursor.bind(this)}
                                >
                                </div>
                            </div>
                        </div>
                        <div className={styles.volumeBox}>
                            <span className={styles.actionIcon}
                                onClick={_ => {
                                    const ratio = this.state.volumeRatio > 0 ? 0 : (this.lastVolumeRatioValue || 1)
                                    this.lastVolumeRatioValue = ratio
                                    this.setState({ volumeRatio: ratio })
                                    this._setVolume(ratio)
                                }}>
                                <span className={bindClass('iconfont', volumeRatio === 0 ? 'icon-mute' : 'icon-volume')}></span>
                            </span>
                            <Slider className={styles.slider} value={volumeRatio} min={0} max={1} step={0.01} onChange={(ratio: number) => {
                                // const ratio = value as number / 100
                                this.setState({
                                    volumeRatio: ratio
                                })
                                this._setVolume(ratio)
                            }} aria-labelledby="continuous-slider" />
                        </div>
                    </div>

                    <div
                        className={styles.right}
                        onClick={_ => {
                            const toPause = !this.state.isPaused
                            this.setState({
                                isPaused: toPause
                            })
                            toPause ? this.audioEle.pause() : this.audioEle.play()
                        }}>
                        <span className={bindClass('iconfont', isPaused ? 'icon-play' : 'icon-pause')}></span>
                    </div>
                </div>
            </div>

        </div>
    }
}
