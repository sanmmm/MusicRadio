import React, { useState, useRef } from 'react';
import { useMediaQuery } from 'react-responsive'
import bindClass from 'classnames'
import { Tabs, message } from 'antd'

import configs from '@/config'
import styles from './style.less'
import MyPlayer from '@/components/player'
import ChatList, { InputMessageBox } from '@/components/chatList'
import MusicList from '@/components/musicList'
import DanmuBox from '@/components/danmu'
import ScrollPage from '@/components/scrollPage'


const { TabPane } = Tabs
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

enum MessageTypes {
    notice, // 系统通知
    advanced, // 高级弹幕， 房管，或超级管理员所发
    normal, // 普通消息
    send, // 发送的消息(仅发送者本地可见)
    response, // 系统响应
}

const messages = [
    {
        from: '伯钧大魔王',
        content: '18年好啊',
        time: '2018-02-03',
        type: MessageTypes.normal
    },
    {
        from: '用户2',
        content: '19年号',
        time: '2019-01-01',
        type: MessageTypes.normal
    },
    {
        from: '用户3',
        content: '19年号',
        time: '2019-01-01 01:22:23',
        type: MessageTypes.normal
    },
    {
        from: '管理员',
        tag: '管理员',
        content: '友好讨论',
        time: '2019-01-03',
        type: MessageTypes.advanced
    },
    {
        from: '我是我',
        content: '大家好',
        time: '2019-01-03',
        type: MessageTypes.send
    },
    {
        from: '系统',
        content: '发送失败',
        time: '2019-01-03',
        type: MessageTypes.response
    },
    {
        from: '系统消息',
        content: '123已被系统管理员禁言',
        time: '2019-01-03',
        type: MessageTypes.notice
    },
]

const musicList = [
    {
        id: 'song1',// 歌曲id
        name: 'string',// 歌名
        artist: 'string',// 演唱者
        album: 'string',// 专辑
        duration: 323907,// 时长
        from: 'string',// 点歌人
    },
    {
        id: 'song2',// 歌曲id
        name: 'string',// 歌名
        artist: 'string',// 演唱者
        album: 'string',// 专辑
        duration: 323907,// 时长
        from: 'string',// 点歌人
    },
    {
        id: 'song3',// 歌曲id
        name: 'string',// 歌名
        artist: 'string',// 演唱者
        album: 'string',// 专辑
        duration: 323907,// 时长
        from: 'string',// 点歌人
    },
]

interface IndexProps {

}

enum TabTyps {
    musicList = 'musicList',
    chatList = 'chatList'
}

const Index: React.FC<IndexProps> = function (props) {
    const isMobile = useMediaQuery({ query: configs.mobileMediaQuery })
    const [activeTab, setActiveTab] = useState(TabTyps.chatList)
    const scrollRef = useRef(null)
    return <ScrollPage ref={scrollRef}>
        <div className={bindClass(styles.radioPage, isMobile ? '' : styles.normal)} on={_ => message.warn('wheel')}>
            <div className={styles.left}>
                <MyPlayer name="情不得已" artist="庾澄庆" comment={{
                    content: comment,
                    userId: 29879272,
                    avatarUrl: 'http://p1.music.126.net/p9U80ex1B1ciPFa125xV5A==/5931865232210340.jpg?param=180y180',
                    nickName: '张惠妹'
                }} src={src} totalTime={264} lrc={lyric} pic={"https://y.gtimg.cn/music/photo_new/T002R300x300M0000024uN121wrWdZ_1.jpg?max_age=2592000"} />
                <DanmuBox maxShowCount={3} />
            </div>
            <div className={styles.right}>
                <Tabs activeKey={activeTab} onChange={type => setActiveTab(type as TabTyps)}>
                    <TabPane forceRender={true} key={TabTyps.chatList} tab="消息列表">
                        <div className={styles.chatTabContent}>
                            <ChatList messages={messages} />
                            <InputMessageBox handleSendMessage={_ => null} />
                        </div>
                    </TabPane>
                    <TabPane forceRender={true} key={TabTyps.musicList} tab="播放列表">
                        <MusicList isEditMode={true} />

                    </TabPane>
                </Tabs>
            </div>
                <div onClick={_ => {
                    console.log(scrollRef.current)
                    scrollRef.current.toPreviousPage()
                }}>upup</div>
                <div   onClick={_ => {
                    console.log(scrollRef.current)
                    scrollRef.current.toNextPage()
                }}>next</div>
        </div>
        <div>
            page222222
            <div onClick={_ => {
                    console.log(scrollRef.current)
                    scrollRef.current.toPreviousPage()
                }}>upup</div>
                <div   onClick={_ => {
                    console.log(scrollRef.current)
                    scrollRef.current.toNextPage()
                }}>next</div>
        </div>
        <div>
            page3333
            <div onClick={_ => {
                    console.log(scrollRef.current)
                    scrollRef.current.toPreviousPage()
                }}>upup</div>
                <div   onClick={_ => {
                    console.log(scrollRef.current)
                    scrollRef.current.toNextPage()
                }}>next</div>
        </div>
    </ScrollPage>
}

export default Index
