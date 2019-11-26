import React, { useState, useRef, useEffect } from 'react';
import { useMediaQuery } from 'react-responsive'
import bindClass from 'classnames'
import { connect } from 'dva'
import { Tab, Tabs, makeStyles } from '@material-ui/core'

import { MessageTypes } from '@/typeConfig'
import { ConnectProps, ConnectState } from '@/models/connect'
import configs from '@/config'
import styles from './style.less'
import MyPlayer from '@/components/player'
import ChatList from '@/components/chatList'
import PlayList from '@/components/musicList'
import DanmuBox from '@/components/danmu'
import ScrollPage, { ScrollPageItem } from '@/components/scrollPage'
import RoomItem from '@/components/roomItem'
import usePreventScrollAndSwipe from '@/components/hooks/preventScrollAndSwipe'
import CrateRoom from './createRoom'
import MessageInputBox from './input'
import HandleSelectedMessage from './handleSelectMessage'
import { CustomTabs, CustomTab } from '../../utils/styleInject'

const comment = '昨天上班时间，我装着西服站在二楼窗前看着路上来来往往的车们。着西服站在二楼窗前看着路上来来往往, 着西服站在二楼窗前看着路上来来往往,觉得城市里天空太窄，忽然想回家种地。可是离我退休年龄还狠遥远。我的影子说想杀死我，然后替代我好好生活。'

const lyric = `
[00:04.050]
[00:12.570]难以忘记初次见你
[00:16.860]一双迷人的眼睛
[00:21.460]在我脑海里
[00:23.960]你的身影 挥散不去
[00:30.160]握你的双手感觉你的温柔
[00:34.940]真的有点透不过气
[00:39.680]你的天真 我想珍惜
[00:43.880]看到你受委屈 我会伤心
[00:48.180]喔
[00:50.340]只怕我自己会爱上你
[00:55.070]不敢让自己靠的太近
[00:59.550]怕我没什么能够给你
[01:04.030]爱你也需要很大的勇气
[01:08.190]只怕我自己会爱上你
[01:12.910]也许有天会情不自禁
[01:17.380]想念只让自己苦了自己
[01:21.840]爱上你是我情非得已
[01:28.810]难以忘记初次见你
[01:33.170]一双迷人的眼睛
[01:37.700]在我脑海里 你的身影 挥散不去
[01:46.360]握你的双手感觉你的温柔
[01:51.120]真的有点透不过气
[01:55.910]你的天真 我想珍惜
[02:00.150]看到你受委屈 我会伤心
[02:04.490]喔
[02:06.540]只怕我自己会爱上你
[02:11.240]不敢让自己靠的太近
[02:15.750]怕我没什么能够给你
[02:20.200]爱你也需要很大的勇气
[02:24.570]只怕我自己会爱上你
[02:29.230]也许有天会情不自禁
[02:33.680]想念只让自己苦了自己
[02:38.140]爱上你是我情非得已
[03:04.060]什么原因 耶
[03:07.730]我竟然又会遇见你
[03:13.020]我真的真的不愿意
[03:16.630]就这样陷入爱的陷阱
[03:20.700]喔
[03:22.910]只怕我自己会爱上你
[03:27.570]不敢让自己靠的太近
[03:32.040]怕我没什么能够给你
[03:36.560]爱你也需要很大的勇气
[03:40.740]只怕我自己会爱上你
[03:45.460]也许有天会情不自禁
[03:49.990]想念只让自己苦了自己
[03:54.510]爱上你是我情非得已
[03:58.970]爱上你是我情非得已
[04:03.000]
`

const src = 'http://localhost:3001/static/test.mp3'

const messages = [
    {
        from: '伯钧大魔王',
        content: {
            text: '18年好啊',
        },
        time: '2018-02-03',
        type: MessageTypes.normal
    },
    {
        from: '用户2',
        content: {
            text: '19年号',
        },
        time: '2019-01-01',
        type: MessageTypes.normal
    },
    {
        from: '用户3',
        content: {
            text: '19年号',
        },
        time: '2019-01-01 01:22:23',
        type: MessageTypes.normal
    },
    {
        from: '管理员',
        tag: '管理员',
        content: {
            text: '友好讨论',
        },
        time: '2019-01-03',
        type: MessageTypes.advanced
    },
    {
        from: '我是我',
        content: {
            text: '大家好',
        },
        time: '2019-01-03',
        type: MessageTypes.send
    },
    {
        from: '系统',
        content: {
            text: '发送失败',
        },
        time: '2019-01-03',
        type: MessageTypes.response
    },
    {
        from: '系统消息',
        content: {
            text: '123已被系统管理员禁言',
        },
        time: '2019-01-03',
        type: MessageTypes.notice
    },
    {
        from: '系统消息',
        content: {
            title: '心脏扑通扑通(印尼小胖子 TATAN)',
            img: 'https://i.loli.net/2019/11/20/YhAwOXBMeqnJRGx.gif'
        },
        time: '2019-01-03',
        type: MessageTypes.emoji
    },
]


const playList = [
    {
        id: 'song1',// 歌曲id
        name: 'song1',// 歌名
        artist: 'string',// 演唱者
        album: 'string',// 专辑
        duration: 323907,// 时长
        isBlock: false,
        from: 'string',// 点歌人
    },
    {
        id: 'song2',// 歌曲id
        name: 'song2',// 歌名
        artist: 'string',// 演唱者
        album: 'string',// 专辑
        duration: 323907,// 时长
        isBlock: false,
        from: 'string',// 点歌人
    },
    {
        id: 'song3',// 歌曲id
        name: 'song3',// 歌名
        artist: 'string',// 演唱者
        album: 'string',// 专辑
        duration: 323907,// 时长
        isBlock: false,
        from: 'string',// 点歌人
    },
]

const searchMusiclist = [
    {
        type: 1,
        list: [{
            type: 1,
            title: '单曲1很长名字酣畅很长哈哈哈哈哈哈哈哈哈哈哈哈哈',
            desc: 'string',
            pic: 'https://y.gtimg.cn/music/photo_new/T002R300x300M0000024uN121wrWdZ_1.jpg?max_age=2592000',
            id: '2334',
        },
        {
            type: 1,
            title: '单曲2',
            desc: 'string',
            pic: 'https://y.gtimg.cn/music/photo_new/T002R300x300M0000024uN121wrWdZ_1.jpg?max_age=2592000',
            id: 'strifsdsffsng',
        },]
    },
    {
        type: 2,
        list: [{
            type: 2,
            title: '专辑1',
            desc: 'string',
            pic: 'https://y.gtimg.cn/music/photo_new/T002R300x300M0000024uN121wrWdZ_1.jpg?max_age=2592000',
            id: '2334',
        },
        {
            type: 2,
            title: '专辑2',
            desc: 'string',
            pic: 'https://y.gtimg.cn/music/photo_new/T002R300x300M0000024uN121wrWdZ_1.jpg?max_age=2592000',
            id: 'strifsdsffsng',
        },]
    },
]

const mediaDetail = {
    name: '青年晚报',
    desc: 'desc',
    pic: '',
    list: [{
        type: 1,
        title: '单曲1很长名字酣畅很长哈哈哈哈哈哈哈哈哈哈哈哈哈',
        desc: 'string',
        pic: 'https://y.gtimg.cn/music/photo_new/T002R300x300M0000024uN121wrWdZ_1.jpg?max_age=2592000',
        id: '2334',
    },
    {
        type: 1,
        title: '单曲2',
        desc: 'string',
        pic: 'https://y.gtimg.cn/music/photo_new/T002R300x300M0000024uN121wrWdZ_1.jpg?max_age=2592000',
        id: 'strifsdsffsng',
    }]
}

const danmuData = [
    {
        from: '伯钧大魔王',
        content: {
            text: '18年好啊',
        },
        time: '2018-02-03',
        type: MessageTypes.normal
    },
    {
        from: '用户2',
        content: {
            text: '19年号',
        },
        time: '2019-01-01',
        type: MessageTypes.normal
    },
    {
        from: '用户3',
        content: {
            text: '19年号',
        },
        time: '2019-01-01 01:22:23',
        type: MessageTypes.normal
    },
    {
        from: '管理员',
        tag: '管理员',
        content: {
            text: '友好讨论',
        },
        time: '2019-01-033434',
        type: MessageTypes.advanced
    },
    {
        from: '伯钧大魔王',
        content: {
            text: '18年好啊',
        },
        time: '2018-02-03dgf',
        type: MessageTypes.normal
    },
    {
        from: '用户2',
        content: {
            text: '19年号',
        },
        time: '2019-01-01dfdf',
        type: MessageTypes.notice
    },
    {
        from: '用户3',
        content: {
            text: '19年号22',
        },
        time: '2019-01-01 01:22:23dfdf',
        type: MessageTypes.normal
    },
    {
        from: '管理员',
        tag: '管理员',
        content: {
            text: '友好讨论33',
        },
        time: '2019-01-03sdssdsd',
        type: MessageTypes.notice
    },
    {
        from: '伯钧大魔王',
        content: {
            text: '18年好33啊',
        },
        time: '2018-02-03sdsd',
        type: MessageTypes.normal
    },
    {
        from: '用户2',
        content: {
            text: '19年号33',
        },
        time: '2019-01-01dfdfd',
        type: MessageTypes.normal
    },
    {
        from: '用户3',
        content: {
            text: '19年号3333',
        },
        time: '2019-01-0101:22:23dfdf',
        type: MessageTypes.normal
    },
    {
        from: '管理员',
        tag: '管理员',
        content: {
            text: '友好讨333论',
        },
        time: '2019-01-03dfdfdf',
        type: MessageTypes.normal
    },
    {
        from: '管理员',
        tag: '管理员',
        content: {
            title: '宝宝生气了',
            img: 'https://i.loli.net/2019/11/20/YhAwOXBMeqnJRGx.gif'
        },
        time: '2019-01-03dsdsdsdghhhhdf',
        type: MessageTypes.emoji
    },
]

import emojiData from '@/assets/success'
const emojiList = emojiData.map(o => ({
    title: o.title,
    src: o.url,
    id: o.url
}))

interface IndexProps extends ConnectProps {
}

enum TabTyps {
    playList = 'playList',
    chatList = 'chatList'
}

const Index: React.FC<IndexProps> = function (props) {
    const isMobile = useMediaQuery({ query: configs.mobileMediaQuery })
    const [activeTab, setActiveTab] = useState(TabTyps.chatList)
    const scrollRef = useRef(null)
    const actionAreaEleRef = usePreventScrollAndSwipe()
    // TODO  DEV delete
    useEffect(() => {
        props.dispatch({
            type: 'chatList/saveData',
            payload: {
                chatList: messages,
                emojiList: emojiList
            }
        })
        props.dispatch({
            type: 'playList/saveData',
            payload: {
                nowPlaying: {
                    pic: 'https://y.gtimg.cn/music/photo_new/T002R300x300M0000024uN121wrWdZ_1.jpg?max_age=2592000'
                },
                playList: playList
            }
        })
        props.dispatch({
            type: 'center/saveData',
            payload: {
                searchMusicList: searchMusiclist,
                searchMediaDetail: mediaDetail
            }
        })
    }, [])


    useEffect(() => {
        props.dispatch({
            type: 'chatList/addDanmuItem',
            payload: {
                items: danmuData
            }
        })
    }, [])

    return <ScrollPage ref={scrollRef}
    >
        <ScrollPageItem>
            {
                (isShow) => <div className={styles.radioPageOuter}>
                    <HandleSelectedMessage />
                    <div className={bindClass(styles.radioPage, isMobile ? styles.mobile : styles.normal)} >
                        <div className={bindClass(isMobile ? styles.top : styles.left)}>
                            <div className={bindClass(!isShow && styles.fixPlayerBox, isMobile && styles.playerOuter)}>
                                <MyPlayer isMobile={isMobile} name="情不得已" artist="庾澄庆" simpleMode={!isShow} comment={{
                                    content: comment,
                                    userId: 29879272,
                                    avatarUrl: 'http://p1.music.126.net/p9U80ex1B1ciPFa125xV5A==/5931865232210340.jpg?param=180y180',
                                    nickName: '张惠妹'
                                }} src={src} totalTime={264} lrc={lyric} pic={"https://y.gtimg.cn/music/photo_new/T002R300x300M0000024uN121wrWdZ_1.jpg?max_age=2592000"} />
                            </div>
                            <div className={styles.danmuOuter}>
                                <DanmuBox isPause={!isShow} />
                            </div>
                        </div>
                        <div className={isMobile ? styles.bottom : styles.right} ref={actionAreaEleRef}>
                            {
                                isMobile ? <MessageInputBox /> :
                                    <React.Fragment>
                                        <CustomTabs variant="fullWidth" value={activeTab} centered={true} onChange={(_, type) => setActiveTab(type as TabTyps)} scrollButtons="auto">
                                            <CustomTab label="消息列表" value={TabTyps.chatList} />
                                            <CustomTab label="播放列表" value={TabTyps.playList} />
                                        </CustomTabs>
                                        {activeTab == TabTyps.chatList && <div className={styles.chatTabContent}>
                                            <ChatList />
                                            <div className={styles.messageBox}>
                                                <MessageInputBox />
                                            </div>
                                        </div>}
                                        {
                                            activeTab == TabTyps.playList && <PlayList />
                                        }
                                    </React.Fragment>
                            }
                        </div>
                    </div>
                </div>}
        </ScrollPageItem>
        {/* <ScrollPageItem>
           
        </ScrollPageItem>
        <ScrollPageItem>
            {
                () => <div>
                    page3333
            <div onClick={_ => {
                        console.log(scrollRef.current)
                        scrollRef.current.toPreviousPage()
                    }}>upup</div>
                    <div onClick={_ => {
                        console.log(scrollRef.current)
                        scrollRef.current.toNextPage()
                    }}>next</div>
                </div>
            }
        </ScrollPageItem> */}


    </ScrollPage>
}

export default connect(() => {
    return {}
})(Index)
