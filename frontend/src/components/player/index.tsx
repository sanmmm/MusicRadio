import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import bindClass from 'classnames'
import { connect } from 'dva'
import { Dialog, Select, MenuItem, DialogContent, DialogTitle, FormControl, FormControlLabel, Button, InputLabel } from '@material-ui/core'

import { ConnectProps, ConnectState, PlayListModelState } from '@/models/connect'
import { NowPlayingStatus, RoomMusicPlayMode, RoomPlayModeInfo } from '@global/common/enums';
import { LocalStorageKeys } from 'config/type.conf'
import { getLocalStorageData, setLocalStorageData, throttle } from '@/utils';
import { VolumeSlider } from '@/utils/styleInject'
import Lyric from './lyric'
import SignalIcon from '@/components/signalIcon'
import RoomName from '@/components/roomName';
import CustomIcon from '@/components/CustomIcon'
import styles from './index.less'
import configs from 'config/base.conf'
import globalConfig from '@global/common/config';

const RoomPlayModeConfigs = {
    [RoomMusicPlayMode.auto]: {
        icon: 'random-play',
        title: '随机播放',
    },
    [RoomMusicPlayMode.demand]: {
        icon: 'in-order-play',
        title: '列表播放',
    },
}

type ReduxPlayingInfo = PlayListModelState['nowPlaying']

interface PlayerProps extends ConnectProps, ReduxPlayingInfo {
    openDanmu: boolean;
    nowRoomId: string;
    isRoomAdmin: boolean;
    musicId: string;
    isBlocked: boolean;
    isPaused: boolean;
    simpleMode?: boolean;
    isMobile: boolean;
    nowRoomPlayMode: RoomMusicPlayMode;
    roomPlayModeInfo: RoomPlayModeInfo;
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
    }[];
    showSelectPlayModeDialog: boolean;
    isSeeking: boolean;
}


enum NeedToDoActions {
    pausePlay = 1,
    startPlay,
    calcTimeRatio,
    blockMusic
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
    playerEle: HTMLElement;
    roomNameEle: HTMLElement;
    constructor(props) {
        super(props)
        this.state = {
            timeRatio: 0,
            volumeRatio: getLocalStorageData(LocalStorageKeys.volume) || 0.2,
            isDragCursor: false,
            commentTextAlign: 'left',
            musicBuffered: [],
            showSelectPlayModeDialog: false,
            isSeeking: false,
        }
        this.needTodoActionArr = []
        this.commentLineHeight = 1.8
        this._handleMouseMove = this._handleMouseMove.bind(this)
        this._handleMouseUp = this._handleMouseUp.bind(this)
        this._changePlayingStatus = this._changePlayingStatus.bind(this)
        this._handleKeyDown = this._handleKeyDown.bind(this)
        this._handleTimeUpdate = throttle(this._handleTimeUpdate.bind(this), 500)
        this._closeSwitchModeDialog = this._closeSwitchModeDialog.bind(this)
        this._switchRoomPlayMode = this._switchRoomPlayMode.bind(this)
        this.playerEle = document.getElementById(configs.playerHeaderIdSelectorName)
        this.roomNameEle = document.getElementById(configs.roomNameSelectorName)
    }

    componentDidMount() {
        this._calcCommentFontSize(this.props)
        window.addEventListener('keydown', this._handleKeyDown)
    }

    componentWillUnmount() {
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
        if (needTodoActionArr.includes(NeedToDoActions.blockMusic)) {
            if (this.props.isBlocked) {
                this.setState({
                    volumeRatio: 0
                })
                this._setVolume(0, false)
            } else {
                const volumeRatio = getLocalStorageData(LocalStorageKeys.volume) || 0.4
                this.setState({
                    volumeRatio
                })
                this._setVolume(volumeRatio)
            }

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
        if (musicIdChanged || nextProps.isBlocked !== this.props.isBlocked) {
            this.needTodoActionArr.push(NeedToDoActions.blockMusic)
        }
    }

    _startPlay() {
        if (!this.audioEle || this.audioEle.readyState === 0) {
            console.log('music not loaded!', this.audioEle, this.audioEle.readyState)
            return
        }
        console.log('start play')
        this._refreshMusicBuffered()
        this._calcTimeRatioByEndAtOrProgress()
        this._setVolume(this.state.volumeRatio)
        this.audioEle.play()
    }

    _setVolume(ratio: number, syncLocalStorage = true) {
        syncLocalStorage && setLocalStorageData(LocalStorageKeys.volume, ratio)
        console.log('set ratio', ratio)
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

    _isReallyPaused () {
        return this.props.isPaused || this.state.isDragCursor 
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
            musicBuffered,
        })
    }

    _handleTimeUpdate() {
        const { duration } = this.props
        console.log('progress update:', this.audioEle.currentTime)
        this.setState({
            timeRatio: this.audioEle.currentTime / duration,
        })
    }

    _getIsProgressPending(isPaused: boolean) {
        const { timeRatio, musicBuffered, isSeeking: isWaitLoading } = this.state
        console.log(musicBuffered, this.audioEle && this.audioEle.buffered)
        return !isPaused && (
            isWaitLoading || !musicBuffered.some(({ startRatio, endRatio }) => {
                return timeRatio >= startRatio && timeRatio <= endRatio
            })
        )
    }

    _handleKeyDown(e) {
        if (e && e.code && e.code.toLocaleLowerCase() === 'space') {
            const target = e.target
            if (target instanceof HTMLInputElement) {
                return
            }
            this._changePlayingStatus()
        }
    }

    _changePlayingStatus() {
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

    _setOpenDanmu() {
        this.props.dispatch({
            type: 'center/saveData',
            payload: {
                openDanmu: !this.props.openDanmu
            }
        })
        setLocalStorageData(LocalStorageKeys.openDanmu, !this.props.openDanmu)
    }

    _showSwitchModeDialog() {
        this.setState({
            showSelectPlayModeDialog: true,
        })
    }

    _closeSwitchModeDialog() {
        this.setState({
            showSelectPlayModeDialog: false,
        })
    }

    _switchRoomPlayMode(data) {
        this.props.dispatch({
            type: 'center/swtichRoomPlayMode',
            payload: {
                roomId: this.props.nowRoomId,
                ...data,
            }
        })
        this._closeSwitchModeDialog()
    }

    _handlePlayingProgressNotReady () {
        console.log('suspend')
        this._refreshMusicBuffered()
        // if (this.audioEle.paused) {
        //     this.setState({
        //         isWaitLoading: true,
        //     })
        // }
    }

    _contralAble() {
        const { isRoomAdmin, status: playingStatus } = this.props
        const contralAble = isRoomAdmin && playingStatus && playingStatus !== NowPlayingStatus.preloading
        return contralAble
    }

    render() {
        const { src, lyric, duration, pic, name, artist, comment, simpleMode, isMobile, musicId,
            isPaused, status: playingStatus, isRoomAdmin, nowRoomPlayMode } = this.props
        const { timeRatio, volumeRatio, commentFontSize, commentTextAlign, isDragCursor } = this.state
        const curcorSize = 8
        const progressLineHeight = 2

        const renderCommentObj = comment || {
            content: '',
            nickName: '',
            avatarUrl: '',
            userId: '',
        }
        const isReallyPaused = this._isReallyPaused()
        const isProgressPending = this._getIsProgressPending(isReallyPaused)
        const controlAble = this._contralAble()

        const lyRicNode = <div className={styles.lyricOuter}>
            <Lyric lyric={lyric} nowTime={timeRatio * duration} showItemCount={isMobile ? 2 : 4} id={musicId} />
        </div>
        const commentNode = <div className={styles.commentBox}>
            <div className={bindClass(styles.showData, !comment && styles.hide)} ref={ele => this.commentBoxEle = ele}
            >
                <div className={styles.top} ref={ele => this.commentTopEle = ele}><CustomIcon>quoteleft</CustomIcon></div>
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
        const controlNode = <div className={styles.controlBox}>
            <div className={styles.left}>
                <div className={styles.musicBaseInfo}>
                    {
                        !isPaused && <SignalIcon />
                    }
                    <div className={styles.content}>
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
                    </div>
                </div>
                <div className={bindClass(styles.progressOuter, controlAble && styles.controlAble)} onMouseDown={controlAble ? this._startDragCursor.bind(this) : null} >
                    <div className={styles.progress} ref={ele => this.progressEle = ele} style={{ height: progressLineHeight }} >
                        <div className={styles.base} >
                        </div>
                        <div className={styles.past} style={{ width: `${timeRatio * 100}%` }}>
                        </div>
                        {
                            controlAble &&
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
                    !isMobile && <div className={styles.bottomBox}>
                        <div className={styles.left}>
                            <CustomIcon onClick={this._setOpenDanmu.bind(this)} title={
                                this.props.openDanmu ? '关闭弹幕' : '开启弹幕'
                            } style={{
                                fontSize: 20
                            }}>
                                {
                                    this.props.openDanmu ? 'danmu-disabled' : 'danmu'
                                }
                            </CustomIcon>
                            <span className={bindClass(styles.volumeActionIcon, 'iconfont', volumeRatio === 0 ? 'icon-mute' : 'icon-volume')}
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
                        </div>
                        <div className={styles.right}>
                            {
                                (() => {
                                    const config = RoomPlayModeConfigs[nowRoomPlayMode]
                                    return !!config && (
                                        isRoomAdmin ? <CustomIcon title={config.title} className={styles.clickAble} onClick={this._showSwitchModeDialog.bind(this)}>{config.icon}</CustomIcon> :
                                    <span>{config.title}中</span>
                                    )
                                })()
                            }
                        </div>
                    </div>}
            </div>

            {
                controlAble &&
                <div
                    className={styles.right}
                    onClick={this._changePlayingStatus}>
                    <CustomIcon className={styles.iconfont}>
                        {
                            (isDragCursor || isPaused) ? 'play' : 'pause'
                        }
                    </CustomIcon>
                </div>
            }
        </div>

        const audio = <audio src={src}
            style={{ display: 'none' }}
            ref={ele => this.audioEle = ele}
            preload="auto"
            onLoadStart={_ => console.log('start----------load')}
            onProgress={this._refreshMusicBuffered.bind(this)}
            onTimeUpdate={this._handleTimeUpdate}
            onCanPlay={_ => {
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
            onSeeking={() => {
                this.setState({
                    isSeeking: true,
                })
            }}
            onSeeked={() => {
                this.setState({
                    isSeeking: false,
                })
            }}
        ></audio>

        const returnNode = <div className={bindClass(styles.playerBox, simpleMode && styles.simpleMode, isMobile ? styles.mobileMode : styles.normal)}>
            {
                !isMobile && <div className={styles.left}>
                    <div className={bindClass(!isPaused && styles.rotate, styles.picBox, simpleMode && styles.simpleMode)}>
                        {pic ? <img src={pic} /> : <div className={styles.noPic}>暂无封面</div>}
                    </div>
                    {
                        !simpleMode && lyRicNode
                    }
                </div>}
            {
                isMobile ? <div className={styles.mobileMain}>
                    {commentNode}
                    {lyRicNode}
                    {controlNode}
                </div> :
                    <div className={bindClass(styles.main, simpleMode && styles.simpleMode)}>
                        {
                            !simpleMode && commentNode
                        }
                        {
                            controlNode
                        }
                    </div>}
        </div>
        return <React.Fragment>
            <SwitchPlayModeDialog open={this.state.showSelectPlayModeDialog}
                isMobile={this.props.isMobile}
                playModeInfo={this.props.roomPlayModeInfo}
                onClose={this._closeSwitchModeDialog}
                onSubmit={this._switchRoomPlayMode}
            />
            {!simpleMode && createPortal(<RoomName />, this.roomNameEle)}
            {createPortal(audio, this.playerEle)}
            {(!isMobile && simpleMode) ? createPortal(returnNode, this.playerEle) : returnNode}
        </React.Fragment>
    }
}

export default connect<PlayerProps, any, Pick<PlayerProps, 'simpleMode' | 'isMobile'>>(
    ({ playList: { nowPlaying }, center: { nowRoomInfo, userInfo, blockPlayItems, isRoomAdmin, openDanmu } }: ConnectState
    ) => {
        const musicId = nowPlaying && nowPlaying.id
        const isBlocked = (blockPlayItems || []).some(blockedId => blockedId === musicId)
        return {
            openDanmu,
            isRoomAdmin,
            nowRoomId: nowRoomInfo && nowRoomInfo.id,
            nowRoomPlayMode: nowRoomInfo && nowRoomInfo.playMode,
            roomPlayModeInfo: nowRoomInfo && nowRoomInfo.playModeInfo,
            musicId,
            isBlocked,
            isPaused: !(nowPlaying && nowPlaying.status === NowPlayingStatus.playing),
            ...(nowPlaying || {}) as any
        }
    })(Player)



const SwitchPlayModeDialog = React.memo<{
    open: boolean;
    playModeInfo: RoomPlayModeInfo;
    isMobile: boolean;  
    onClose: () => any;
    onSubmit: (obj: {
        mode: RoomMusicPlayMode;
        autoPlayType?: string;
    }) => any;
}>(props => {
    const {playModeInfo, open} = props
    const [rooMode, setRoomMode] = useState(null)
    const [autoPlayType, setAutoPlayType] = useState(null)
    const handleModeSelect = (e) => {
        setRoomMode(e.target.value)
        setAutoPlayType(null)
    }
    const handleAutoPlayTypeSelect = (e) => setAutoPlayType(e.target.value)

    useEffect(() => {
        let roomMode = null, autoPlayType = null
        if (playModeInfo) {
            roomMode = String(playModeInfo.mode)
            autoPlayType = playModeInfo.autoPlayType || null
        }
        setRoomMode(roomMode)
        setAutoPlayType(autoPlayType)
    }, [playModeInfo, open])

    return <Dialog open={props.open} onClose={props.onClose} fullWidth={true} maxWidth={props.isMobile ? 'lg' : 'xs'}>
        <DialogTitle>切换播放模式</DialogTitle>
        <DialogContent>
            <FormControl fullWidth={true}>
                <FormControl fullWidth={true} margin="normal">
                    <InputLabel>模式</InputLabel>
                    <Select value={rooMode} onChange={handleModeSelect}>
                            {
                                Object.entries(RoomPlayModeConfigs).map(([type, config]) => {
                                    return <MenuItem value={type}>{config.title}</MenuItem>
                                })
                            }
                        </Select>
                </FormControl>
                {
                    Number(rooMode) === RoomMusicPlayMode.auto && <FormControl fullWidth={true} margin="normal">
                         <InputLabel>类型</InputLabel>
                         <Select value={autoPlayType} onChange={handleAutoPlayTypeSelect}>
                                {
                                    globalConfig.roomAutoPlayTypes.map(type => <MenuItem value={type}>
                                        {type}
                                    </MenuItem>)}
                            </Select>
                    </FormControl>}
                <FormControl fullWidth={true} margin="normal">
                    <Button color="primary" variant="contained" onClick={props.onSubmit.bind(null, {
                        mode: Number(rooMode),
                        autoPlayType,
                    })}>
                        提交
                    </Button>

                </FormControl>
            </FormControl>
        </DialogContent>
    </Dialog>
})
