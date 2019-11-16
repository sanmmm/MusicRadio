import React, { } from 'react'
import bindClass from 'classnames'
import Lyric from './lyric'
import { Slider } from '@material-ui/core'
import styles from './index.less'

interface PlayerProps {
    name: string;
    artist: string;
    src: string;
    totalTime: number;
    lrc?: string;
    pic?: string;
    simpleMode?: boolean // 简单模式，只能听，不能操作
}

interface PlayerState {
    timeRatio: number;
    volumeRatio: number;
    isDragCursor: boolean;
    isPaused: boolean;
}

export default class Player extends React.Component<PlayerProps, PlayerState> {
    audioEle: HTMLAudioElement
    progressEle: HTMLDivElement
    lastVolumeRatioValue: number
    constructor(props) {
        super(props)
        this.state = {
            timeRatio: 0,
            volumeRatio: 0.4,
            isDragCursor: false,
            isPaused: true,
        }
        this._handleMouseMove = this._handleMouseMove.bind(this)
        this._handleMouseUp = this._handleMouseUp.bind(this)

    }

    componentDidMount() {
        // this.audioEle.play()
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

    render() {
        const { src, lrc, totalTime, pic } = this.props
        const { timeRatio, volumeRatio, isPaused } = this.state
        const curcorSize = 8
        const progressLineHeight = 2
        return <div className={styles.playerBox}>
            <div className={bindClass(!isPaused && styles.rotate, styles.picBox)}>
                {pic ? <img src={pic} /> : <div className={styles.noPic}>暂无封面</div>}
            </div>
            <audio src={src}
                ref={ele => this.audioEle = ele}
                controls={true}
                onTimeUpdate={event => {
                    console.log(this.audioEle.currentTime)
                    this.setState({
                        timeRatio: this.audioEle.currentTime / totalTime
                    })
                }}
            ></audio>
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
            <div onClick={_ => {
                const toPause = !this.state.isPaused
                this.setState({
                    isPaused: toPause
                })
                toPause ? this.audioEle.pause() : this.audioEle.play()
            }}>
                {isPaused ? '播放' : '暂停'}
            </div>
            <div className={styles.volumeBox}>
                <span className={styles.actionIcon}
                    onClick={_ => {
                        const ratio = this.state.volumeRatio > 0 ? 0 : (this.lastVolumeRatioValue || 1)
                        this.lastVolumeRatioValue = ratio
                        this.setState({ volumeRatio: ratio })
                        this._setVolume(ratio)
                    }}>
                    {volumeRatio === 0 ? '静音' : '正常'}
                </span>
                <Slider className={styles.slider} value={volumeRatio * 100} onChange={(e, value) => {
                    const ratio = value as number / 100
                    this.setState({
                        volumeRatio: ratio
                    })
                    this._setVolume(ratio)
                }} aria-labelledby="continuous-slider" />
            </div>
            <Lyric lyric={this.props.lrc} nowTime={timeRatio * totalTime} showItemCount={4} id="id" />
        </div>
    }
}
