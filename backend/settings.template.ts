export default {
    neteaseApiServer: 'http://localhost:3000',
    port: 3001,
    sessionKey: 'musicradio',
    sessionSecret: 'justdoit',
    sessionExpire: 3600 * 24 * 30,
    redisPort: 6379,
    redisHost: 'localhost',
    origin: '', // socket server 允许的跨域请求源
    musicDurationLimit: 60 * 6, // 音乐时长限制
    superAdminToken: ['admin'], // token 认证模式下的超级管理员token
    maxChatListLength: 20, // 服务端记录的房间聊天记录条数上限
}