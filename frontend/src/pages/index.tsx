import React, { useEffect } from 'react';
import APlayer from 'aplayer'
import 'aplayer/dist/APlayer.min.css';
import styles from './index.css';
import MyPlayer from '../components/player'
import Index from './index/index'
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
export default function () {
  // useEffect(() => {
  //   const ap = new APlayer({
  //     container: document.getElementById('player'),
  //     lrcType: 1,
  //     listFolded: false,
  //     listMaxHeight: 90,
  //     audio: [{
  //       name: 'name',
  //       artist: 'artist',
  //       url: 'http://m7.music.126.net/20191115174434/c18d3f14269947be06b9cb213c0cfe98/ymusic/0fd6/4f65/43ed/a8772889f38dfcb91c04da915b301617.mp3',
  //       cover: 'https://ss3.baidu.com/-fo3dSag_xI4khGko9WTAnF6hhy/image/h%3D300/sign=b5e4c905865494ee982209191df4e0e1/c2cec3fdfc03924590b2a9b58d94a4c27d1e2500.jpg',
  //       lrc: lyric
  //     }, {
  //       name: 'name',
  //       artist: 'artist',
  //       url: 'http://m7.music.126.net/20191115174434/c18d3f14269947be06b9cb213c0cfe98/ymusic/0fd6/4f65/43ed/a8772889f38dfcb91c04da915b301617.mp3',
  //       cover: 'https://ss3.baidu.com/-fo3dSag_xI4khGko9WTAnF6hhy/image/h%3D300/sign=b5e4c905865494ee982209191df4e0e1/c2cec3fdfc03924590b2a9b58d94a4c27d1e2500.jpg',
  //       lrc: lyric
  //     }]
  //   });
  // }, [])
  return (
    <div className={styles.normal}>
      {/* <div className={styles.mask}>

      </div>
      <div className={styles.playerBackground}>

      </div> */}
      <Index/>
      {/* <MyPlayer name="情不得已" artist="庾澄庆" src={src} totalTime={264} lrc={lyric} pic={"https://y.gtimg.cn/music/photo_new/T002R300x300M0000024uN121wrWdZ_1.jpg?max_age=2592000"}/>  */}
      {/* <div id="player">

      </div>
      <div className={styles.welcome} />
      <ul className={styles.list}>
        <li>To get started, edit <code>src/pages/index.js</code> and save to reload.</li>
        <li>
          <a href="https://umijs.org/guide/getting-started.html">
            Getting Started
          </a>
        </li>
      </ul> */}
    </div>
  );
}
