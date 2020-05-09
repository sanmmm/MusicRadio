module.exports = {
    neteaseApiServer: 'http://neteaseapi:3000', 
    httpServer: '',
    port: 3001,
    sessionKey: 'musicradio',
    sessionSecret: 'justdoit',
    sessionExpire: 3600 * 24 * 30,
    redisPort: 6379,
    redisHost: 'redis', // docker redis server
    corsOrigin: [], // http/socket server 允许的跨域请求源, 为空时表示没有跨域限制
    musicDurationLimit: 60 * 6, // 音乐时长限制
    superAdminToken: ['123'], // token 认证模式下的超级管理员token example: ['admin1', 'admin2']
    maxChatListLength: 20, // 服务端记录的房间聊天记录条数上限
    hashSalt: 'balalacool',
    superAdminRegisterTokens: ['123'], // 超级管理员注册码  example: ['registerToken', 'registerToken1']
    openWordValidate: true, // 是否开启敏感词过滤
    coordDataCalcDuration: 60 * 10 ,// 房间热点数据整理计算刷新周期
    coordDataCalcIncMode: false, // 【每个热点数据计算周期】不清空之前周期的数据而是合并数据
    // 以下仅在dev模式下有效
    openRandomIpMode: false, // 为用户随机分配所属ip地址
}