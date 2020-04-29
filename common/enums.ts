export enum ClientListenSocketEvents {
    disconnect = 'disconnect',
    reconnecting = 'reconnecting',
    recieveNowPlayingInfo = 'recieveNowPlayingInfo', // 更新当前播放的音乐信息
    addChatListMessages = 'addChatListMessages', // 接受消息
    withdrawlChatListMessage = 'withdrawlChatListMessage', // 撤回消息
    addPlayListItems = 'addPlayListItems', // 播放列表添加音乐
    movePlayListItem = 'movePlayListItem', // 播放列表删除音乐
    deletePlayListItems = 'deletePlayListItems',// 删除播放列表中的音乐
    updateRoomInfo = 'updateRoomInfo', // 客户端更新当前房间的基础信息
    updateUserInfo = 'updateUserInfo', // 客户端更新当前用户信息
    updateSocketStatus = 'updateSocketStatus', // 客户端更新socket连接状态
    updateNowRoomBaseInfo = 'updateNowRoomBaseInfo', // 客户端更新当前房间信息
    updateRoomCutMusicVoteInfo = 'updateCutMusicVoteInfo', // 更新切歌投票信息
    addAdminActions = 'addAdminActions', // 更新管理操作记录列表 
    deleteAdminActions = 'deleteAdminActions', // 删除管理操作记录列表 
    updateOnlineUsers = 'updateOnlineUsers', // 更新在线用户列表信息
    notification = 'notification', // 客户端接受通知
}

export enum ServerListenSocketEvents {
    disconnect = 'disconnect',
    sendMessage = 'sendMessage', // 发送消息
    withdrawlMessage = 'withdrawlMessage', // 撤回消息(admin)
    pausePlaying = 'pausePlaying', // 暂停播放(admin)
    startPlaying = 'startPlaying', // 开始播放(admin)
    changeProgress = 'changeProgress', // 调整播放进度(admin)
    switchPlayMode = 'switchPlayMode', // 切换播放模式 (admin)
    voteToCutMusic = 'voteToCutMusic', // 发起切歌投票 
    addPlayListItems = 'addPlayListItems', // 添加音乐到播放列表
    movePlayListItem = 'movePlayListItem', // 移动播放列表中的音乐 (admin)
    deletePlayListItems = 'deletePlayListItems', // 删除播放列表中的音乐 (admin)
    blockPlayListItems = 'blockPlayListItems', // 个人账号屏蔽音乐（屏蔽之后 轮播到该音乐时 会自动静音）
    unblockPlayListItems = 'unblockPlayListItems', // 个人账号取消屏蔽音乐  
    setNickName = 'setNickName', // 设置昵称  
    searchMedia = 'searchMedia', // 搜索音乐，专辑
    getMediaDetail = 'getMediaDetail', // 获取 专辑详情
    banUserComment = 'banUserComment', // 禁言 (admin)
    blockUser = 'blockUser', // 封禁用户 (admin)
    blockUserIp = 'blockUserIp', // 封禁ip (admin)
    revokeAction = 'revokeAction', // 管理员撤回操作 (admin)
    createRoom = 'createRoom', // 创建房间 
    destroyRoom = 'destroyRoom', // 销毁房间 (admin)
    joinRoom = 'joinRoom', // 加入房间 
    quitRoom = 'quitRoom', // 退出房间
    getRoomData = 'getRoomData', // 获取房间数据, 用于初始化
    recommendRoom = 'recommendRoom', // 获取 推荐房间列表
    getEmojiList = 'getEmojiList', // 获取表情包列表
    getRoomCoordHotData = 'getRoomCoordHotData', // 获取可视化地图坐标热点数据
    getOnlineUserList = 'getOnlineUserList', // 获取房间在线用户 (admin)
    getRoomAdminActionList = 'getRoomAdminActionList', // 获取房间管理员操作记录列表 (admin)
    manageRoomAdmin = 'manageRoomAdmin', // 撤销、设置房间管理员
    cutUserStatus = 'cutUserStatus', //切换 超级管理员角色身份（普通用户视角 <-> 超级管理员）
}

export enum ScoketStatus {
    closed, // 连接关闭
    waitting, // 等待连接建立中
    invalid, // 认证未通过
    roomDestroy, // 房间被销毁
    roomBlocked, // 被该房间屏蔽
    globalBlocked, // 被全站屏蔽
    connected, // 连接已建立
    reconnecting, // 断线重连中,
}


export enum NowPlayingStatus {
    preloading = 'preloading',
    playing = 'playing',
    paused = 'paused',
}

export enum RoomMusicPlayMode {
    demand = 1, // 点歌播放
    auto, // 自动随机播放
}

export interface RoomPlayModeInfo {
    mode: RoomMusicPlayMode;
    autoPlayType?: string;
}