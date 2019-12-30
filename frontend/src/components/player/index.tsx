import React from 'react'
import bindClass from 'classnames'
import MediaQuery from 'react-responsive'
import { connect } from 'dva'

import { ConnectProps, ConnectState, PlayListModelState } from '@/models/connect'
import { NowPlayingStatus } from '@global/common/enums'
import { LocalStorageKeys } from '@/typeConfig'
import { getLocalStorageData, setLocalStorageData } from '@/utils'
import { VolumeSlider } from '@/utils/styleInject'
import Lyric from './lyric'
import SignalIcon from '@/components/signalIcon'
import styles from './index.less'
import configs from '@/config'

type ReduxPlayingInfo = PlayListModelState['nowPlaying']

interface PlayerProps extends ConnectProps, ReduxPlayingInfo {
    nowRoomId: string;
    isRoomAdmin: boolean;
    musicId: string;
    isPaused: boolean;
    simpleMode?: boolean;
    isMobile: boolean;
}

interface PlayerState {
    timeRatio: number;
    volumeRatio: number;
    isDragCursor: boolean;
    commentFontSize?: number;
    commentTextAlign?: 'center' | 'left';
    musicBuffered: {
        startRatio: number;
        endRatio: number;
    }[]
}


enum NeedToDoActions {
    pausePlay = 1,
    startPlay,
    calcTimeRatio,
}

class Player extends React.Component<PlayerProps, PlayerState> {
    static defaultProps = {
        isPaused: true,
        src: '',
        comment: null,
    }
    audioEle: HTMLAudioElement
    progressEle: HTMLDivElement
    lastVolumeRatioValue: number
    commentTopEle: HTMLDivElement
    commentBotttomEle: HTMLDivElement
    commentLineHeight: number // em
    commentBoxEle: HTMLDivElement
    needTodoActionArr: NeedToDoActions[]
    constructor(props) {
        super(props)
        this.state = {
            timeRatio: 0,
            volumeRatio: getLocalStorageData(LocalStorageKeys.volume) || 0.2,
            isDragCursor: false,
            commentTextAlign: 'left',
            musicBuffered: [],
        }
        this.needTodoActionArr = []
        this.commentLineHeight = 1.8
        this._handleMouseMove = this._handleMouseMove.bind(this)
        this._handleMouseUp = this._handleMouseUp.bind(this)
        this._changePlayingStatus = this._changePlayingStatus.bind(this)
        this._handleKeyDown = this._handleKeyDown.bind(this)
    }

    componentDidMount() {
        this._calcCommentFontSize(this.props)
        window.addEventListener('keydown', this._handleKeyDown)
    }

    componentWillUnmount () {
        window.removeEventListener('keydown', this._handleKeyDown)
    }

    componentDidUpdate() {
        const needTodoActionArr = this.needTodoActionArr
        this.needTodoActionArr = [] as any
        if (!this.props.musicId) {
            return
        }
        if (needTodoActionArr.includes(NeedToDoActions.pausePlay)) {
            this.audioEle && this.audioEle.pause()
        }
        if (needTodoActionArr.includes(NeedToDoActions.startPlay)) {
            this._startPlay()
        }
        if (needTodoActionArr.includes(NeedToDoActions.calcTimeRatio)) {
            this._calcTimeRatioByEndAtOrProgress()
        }
    }

    componentWillReceiveProps(nextProps) {
        const musicIdChanged = nextProps.musicId !== this.props.musicId
        if (musicIdChanged) {
            this.setState({
                musicBuffered: [],
                isDragCursor: false,
                timeRatio: 0,
            })
        }
        if (musicIdChanged || nextProps.isPaused !== this.props.isPaused) {
            this.needTodoActionArr.push(nextProps.isPaused ? NeedToDoActions.pausePlay : NeedToDoActions.startPlay)
        }
        if (nextProps.endAt !== this.props.endAt || nextProps.progress !== this.props.progress) {
            this.needTodoActionArr.push(NeedToDoActions.calcTimeRatio)
        }
        if (nextProps.comment && nextProps.comment !== this.props.comment) {
            this._calcCommentFontSize(nextProps)
        }
    }

    _startPlay() {
        if (!this.audioEle || this.audioEle.readyState === 0) {
            console.log('music not loaded!', this.audioEle, this.audioEle.readyState)
            return
        }
        this._refreshMusicBuffered()
        this._calcTimeRatioByEndAtOrProgress()
        this._setVolume(this.state.volumeRatio)
        this.audioEle.play()
    }

    _setVolume(ratio: number) {
        setLocalStorageData(LocalStorageKeys.volume, ratio)
        this.audioEle.volume = ratio
    }

    _calcTimeRatioByEndAtOrProgress() {
        const { progress, endAt, duration, isPaused } = this.props
        let timeRatio = this.state.timeRatio
        if (isPaused) {
            timeRatio = progress
        } else {
            const now = Date.now() / 1000
            timeRatio = now > endAt ? 1 : 1 - (endAt - now) / duration
        }
        this._setTimeRatio(timeRatio)
    }

    _setTimeRatio(ratio: number) {
        const { duration } = this.props
        if (!ratio || !duration) {
            console.log('invalid params', ratio, duration)
            return
        }
        this.setState(prev => ({
            ...prev,
            timeRatio: ratio
        }))
        this.audioEle.currentTime = duration * ratio
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
            this._setTimeRatio(ratio)
        }
    }

    _handleMouseUp(e) { // end
        e.stopPropagation()
        if (this.state.isDragCursor) {
            document.removeEventListener('mousemove', this._handleMouseMove)
            document.removeEventListener('mouseup', this._handleMouseUp)
            const ratio = this._calcTimeRatio(e.pageX)
            this.setState({
                isDragCursor: false,
            })
            this._setTimeRatio(ratio)
            const { nowRoomId, musicId } = this.props
            this.props.dispatch({
                type: 'playList/changePlayingProgress',
                payload: {
                    roomId: nowRoomId,
                    musicId,
                    progress: ratio
                }
            })
                .catch(e => {
                })
                .then(res => {
                    if (this.props.isPaused) {
                        this._calcTimeRatioByEndAtOrProgress()
                    } else {
                        this._startPlay()
                    }
                })
        }
    }

    _startDragCursor(e) {  // start 
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
        if (!comment || !comment.content || !this.commentBoxEle || !this.commentTopEle || !this.commentBotttomEle) {
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
        const textAlign = selectedFontSize * comment.content.length <= maxContentwidth ? 'center' : 'left'
        this.setState(prev => ({
            ...prev,
            commentFontSize: selectedFontSize,
            commentTextAlign: textAlign
        }))
    }

    _refreshMusicBuffered() {
        console.log('pregress change')
        if (!this.audioEle) {
            console.warn('播放器元素未挂载!')
            return
        }
        const buffered = this.audioEle.buffered
        const { duration } = this.props
        const musicBuffered: PlayerState['musicBuffered'] = []
        for (let i = 0; i < buffered.length; i++) {
            const start = buffered.start(i)
            const end = buffered.end(i)
            musicBuffered.push({
                startRatio: start / duration,
                endRatio: end / duration,
            })
        }
        this.setState({
            musicBuffered
        })
    }

    _getIsProgressPending(isPaused: boolean) {
        const { timeRatio, musicBuffered } = this.state
        return !isPaused && !musicBuffered.some(({ startRatio, endRatio }) => {
            return timeRatio >= startRatio && timeRatio <= endRatio
        })
    }

    _handleKeyDown (e) {
        if (e && e.code.toLocaleLowerCase() === 'space') {
            this._changePlayingStatus()
        }
    }

    _changePlayingStatus () {
        if (!this._contralAble()) {
            return
        }
        const { isPaused, musicId, nowRoomId } = this.props
        const toPause = !isPaused
        this.props.dispatch({
            type: toPause ? 'playList/pausePlay' : 'playList/startPlay',
            payload: {
                roomId: nowRoomId,
                musicId: musicId,
            }
        })
    }

    _contralAble () {
        const {isRoomAdmin, status: playingStatus} = this.props
        const contralAble = isRoomAdmin && playingStatus && playingStatus !== NowPlayingStatus.preloading
        return contralAble
    }

    render() {
        const { src, lyric, duration, pic, name, artist, comment, simpleMode, isMobile, musicId,
            isPaused, status: playingStatus, isRoomAdmin } = this.props
        const { timeRatio, volumeRatio, commentFontSize, commentTextAlign, isDragCursor } = this.state
        const curcorSize = 8
        const progressLineHeight = 2

        const renderCommentObj = comment || {
            content: '',
            nickName: '',
            avatarUrl: '',
            userId: '',
        }
        const isReallyPaused = isDragCursor || isPaused
        const isProgressPending = this._getIsProgressPending(isReallyPaused)
        const contralAble = this._contralAble()

        const lyRicNode = <div className={styles.lyricOuter}>
            <Lyric lyric={lyric} nowTime={timeRatio * duration} showItemCount={isMobile ? 2 : 4} id={musicId} />
        </div>
        const commentNode = <div className={styles.commentBox}>
            <div className={bindClass(styles.showData, !comment && styles.hide)} ref={ele => this.commentBoxEle = ele}
            >
                <div className={styles.top} ref={ele => this.commentTopEle = ele}><span className="iconfont icon-quoteleft"></span></div>
                {
                    !!commentFontSize && <p
                        style={{ fontSize: commentFontSize, lineHeight: `${this.commentLineHeight}em`, textAlign: commentTextAlign }}
                        className={styles.content}>{renderCommentObj.content}</p>
                }
                <div className={styles.bottom} ref={ele => this.commentBotttomEle = ele}>
                    <img src={renderCommentObj.avatarUrl} />
                    <span className={styles.nickName} title={`点击查看${renderCommentObj.nickName}的主页`}
                        onClick={_ => window.open(`https://music.163.com/#/user/home?id=${renderCommentObj.userId}`)}
                    >{renderCommentObj.nickName}</span>
                </div>
            </div>
            {
                !comment &&
                <div className={styles.noData}>
                    暂无热评
                    </div>}
        </div>
        const controllNode = <div className={styles.controlBox}>
            <div className={styles.left}>
                <div className={styles.musicBaseInfo}>
                    {
                        !isPaused && <SignalIcon />
                    }
                    <span className={styles.content}>
                        {
                            !!musicId ? [
                                [name, artist].filter(i => !!i).join('-'),
                                playingStatus === NowPlayingStatus.paused && ' (暂停中)',
                                playingStatus === NowPlayingStatus.preloading && ' (播放数据加载中...)',
                            ] :
                                (
                                    isRoomAdmin ? '请选择播放音乐！' : '暂无音乐'
                                )
                        }
                    </span>
                </div>
                <div className={styles.progressOuter} onMouseDown={contralAble && this._startDragCursor.bind(this)} >
                    <div className={styles.progress} ref={ele => this.progressEle = ele} style={{ height: progressLineHeight }} >
                        <div className={styles.base} >
                        </div>
                        <div className={styles.past} style={{ width: `${timeRatio * 100}%` }}>
                        </div>
                        {
                            contralAble &&
                            <div className={bindClass(isProgressPending ? {
                                [styles.pending]: true,
                                'iconfont': true,
                                'icon-load': true
                            } : styles.curcor)}
                                style={{
                                    fontSize: curcorSize,
                                    width: curcorSize, height: curcorSize,
                                    left: `calc(${timeRatio * 100}% - ${curcorSize / 2}px)`, top: (progressLineHeight - curcorSize) / 2
                                }}
                                onMouseDown={this._startDragCursor.bind(this)}
                            >
                            </div>
                        }
                    </div>
                </div>
                {
                    !isMobile && <div className={styles.volumeBox}>
                        <span className={bindClass(styles.actionIcon, 'iconfont', volumeRatio === 0 ? 'icon-mute' : 'icon-volume')}
                                onClick={e => {
                                    const ratio = this.state.volumeRatio > 0 ? 0 : (this.lastVolumeRatioValue || 1)
                                    this.lastVolumeRatioValue = ratio
                                    this.setState({ volumeRatio: ratio })
                                    this._setVolume(ratio)
                                }}
                        >
                            <VolumeSlider className={styles.slider} value={volumeRatio} min={0} max={1} step={0.01} 
                                onChange={(_, ratio: number) => {
                                    this.setState({
                                        volumeRatio: ratio
                                    })
                                    this._setVolume(ratio)
                                }} 
                                aria-labelledby="continuous-slider" 
                                onClick={e => e.stopPropagation()}
                            />
                        </span>

                    </div>}
            </div>

            {
                contralAble &&
                <div
                    className={styles.right}
                    onClick={this._changePlayingStatus}>
                    <span className={bindClass('iconfont', (isDragCursor || isPaused) ? 'icon-play' : 'icon-pause')}></span>
                </div>
            }
        </div>
        return <div className={bindClass(styles.playerBox, simpleMode && styles.simpleMode, isMobile ? styles.mobileMode : styles.normal)}>
            {
                !isMobile && <div className={styles.left}>
                    <div className={bindClass(!isPaused && styles.rotate, styles.picBox, simpleMode && styles.simpleMode)}>
                        {pic ? <img src={pic} /> : <div className={styles.noPic}>暂无封面</div>}
                    </div>
                    {
                        !simpleMode && lyRicNode
                    }
                </div>}
            <audio src={src}
                style={{ display: 'none' }}
                ref={ele => this.audioEle = ele}
                preload="auto"
                onProgress={this._refreshMusicBuffered.bind(this)}
                onTimeUpdate={event => {
                    // console.log('player time update:', this.audioEle.currentTime)
                    this.setState({
                        timeRatio: this.audioEle.currentTime / duration
                    })
                }}
                onLoadedData={_ => {
                    // console.log('on play', this.audioEle.paused, this.audioEle.readyState)
                    if (this.audioEle.readyState !== 4) {
                        return
                    }
                    if (this.props.isPaused) {
                        return
                    }
                    if (!this.audioEle.paused) {
                        return
                    }
                    this._startPlay()
                }}
                onEnded={_ => {
                    this.setState({
                        timeRatio: 1,
                    })
                }}
            ></audio>
            {
                isMobile ? <div className={styles.mobileMain}>
                    {commentNode}
                    {lyRicNode}
                    {controllNode}
                </div> :
                    <div className={bindClass(styles.main, simpleMode && styles.simpleMode)}>
                        {
                            !simpleMode && commentNode
                        }
                        {
                            controllNode
                        }
                    </div>}


        </div>
    }
}
export default connect<Exclude<PlayerProps, 'simpleMode' | 'isMobile'>, any, Pick<PlayerProps, 'simpleMode' | 'isMobile'>>(({ playList: { nowPlaying }, center: { nowRoomInfo, userInfo } }: ConnectState) => {
    return {
        isRoomAdmin: userInfo && (userInfo.isRoomCreator || userInfo.isSuperAdmin),
        nowRoomId: nowRoomInfo && nowRoomInfo.id,
        musicId: nowPlaying && nowPlaying.id,
        isPaused: !(nowPlaying && nowPlaying.status === NowPlayingStatus.playing),
        ...(nowPlaying || {}) as any
    }
})(Player)
