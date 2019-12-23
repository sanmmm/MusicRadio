export interface Session {
    id: string;
    ip: string;
    isAuthenticated: boolean;
    user?: UserModel;
    login: (user: UserModel) => Promise<any>;
    logOut: () => Promise<any>;
    getUser: () => Promise<UserModel>;
}

declare global {
    var hallRoomId: string;
    namespace Express {
        interface Request {
            session?: Session
        }
    }
    namespace SocketIO {
        interface Socket {
            session: Session,
        }
    }
    namespace NodeJS {
        interface Global {
            hallRoomId: string;
        }
    }
}

export enum SessionTypes {ip, cookie, token}

export enum ClientListenSocketEvents {
    recieveNowPlayingInfo = 'recieveNowPlayingInfo',
    addChatListMessages = 'addChatListMessages',
    addPlayListItems = 'addPlayListItems',
    movePlayListItem = 'movePlayListItem',
    deletePlayListItems = 'deletePlayListItems',
    blockPlayListItems = 'blockPlayListItems',
    unblockPlayListItems = 'unblockPlayListItems',
    searchMediaResult = 'searchMediaResult',
    updateRoomInfo = 'updateRoomInfo', // 接受房间的基础信息
    updateMediaDetail = 'updateMediaDetail',  
    updateUserInfo = 'updateUserInfo',
    updateSocketStatus = 'updateSocketStatus',
    updatRecommenedRoomList = 'updatRecommenedRoomList',
    updateEmojiList = 'updateEmojiList',
    notification = 'notification',
    createRoomSuccess = 'createRoomSuccess'
}

export enum ServerListenSocketEvents {
    disconnect = 'disconnect',
    sendMessage = 'sendMessage',
    pausePlaying = 'pausePlaying',
    startPlaying = 'startPlaying',
    changeProgress = 'changeProgress',
    addPlayListItems = 'addPlayListItems',
    movePlayListItem = 'movePlayListItem',
    deletePlayListItems = 'deletePlayListItems',
    blockPlayListItems = 'blockPlayListItems',
    unblockPlayListItems = 'unblockPlayListItems',
    searchMedia = 'searchMedia', // 搜索音乐，专辑
    getMediaDetail = 'getMediaDetail', // 获取 专辑详情
    banUserComment = 'banUserComment', // 禁言
    blockUser = 'blockUser', // 封禁用户
    blockUserIp = 'blockUserIp', // 封禁ip
    revokeAction = 'revokeAction', // 管理员撤回操作
    createRoom = 'createRoom',
    destroyRoom = 'destroyRoom',
    joinRoom = 'joinRoom',
    quitRoom = 'quitRoom',
    getRoomData = 'loadRoomData', // 获取房间数据, 用于初始化
    recommendRoom = 'recommendRoom', // 获取 推荐房间列表
    getEmojiList = 'getEmojiList', // 获取表情包列表
}

export interface StaticModelClass<T = any> {
    new (obj: Partial<T>): T;
    [key: string]: any;
    find: (ids: string[]) => Promise<T[]>;
    findOne: (id: string) => Promise<T>;
    delete: (ids: string[]) => Promise<any>;
    update: (ids: string[], cb: (item: T) => T) => Promise<T[]>;
    fromJson: (str: string) => T
}

export interface ModelBase {
    id: string;
    toJson: () => string;
    save: () => Promise<this>;
    remove: () => Promise<this>;
}

export interface UserModel extends ModelBase {
    isSuperAdmin: boolean;
    name?: string;
    nowRoomId: string;
    ip: string;
    blockPlayItems: string[]; // 用户个人屏蔽的音乐id列表
    allowComment: boolean;
}

export interface RoomModel extends ModelBase {
    creator: string; // 创建者id
    status: RoomStatus; // 
    isPublic: boolean;
    isHallRoom: boolean; // 是否为大厅
    max: number;
    heat: number;
    name: string;
    nowPlayingInfo: {
        id: string;
        name: string;
        artist: string;
        src: string;
        lyric: string;
        pic: string;
        isPaused: boolean;
        progress:number;
        endAt: number; // timestamp 秒
        duration: number; // 秒
        comment: {
            content: string;
            userId: number;
            avatarUrl: string;
            nickName: string;
        };
    };
    joiners: string[];
    banUsers: string[];
    blockIps: string[];
    blockUsers: string[];
    messageHistory: MessageItem[];
    playList: PlayListItem[];
    adminActions: AdminAction[];
}

export enum RoomStatus {
    active, // 当创建者加入时为激活状态
    willDestroy, // 等待被销毁 (创建者被动断开连接超过一定时间，房间会被销毁)
}

export enum MessageTypes {
    notice, // 系统通知
    advanced, // 高级弹幕， 房管，或超级管理员所发
    normal, // 普通消息
    emoji, // 表情消息
    notification, // 系统响应
}

export interface MessageItem {
    id: string;
    fromId?: string;
    from: string;
    tag?: string; // [tag][message]
    content: {
        text?: string;
        title?: string;
        img?: string;
    };
    time: string | number;
    type: MessageTypes;
}

export interface PlayListItem {
    id: string; // 歌曲id
    name: string; // 歌名
    artist: string; // 演唱者
    album: string; // 专辑
    duration: number; // 时长  ms
    from: string; // 点歌人
    fromId: string; // 点歌人id
}

export enum MediaTypes {
    song = 1, // 单曲
    album, // 专辑
}

export enum ScoketStatus {
    connected,
    invalid,
    roomBlocked,
    globalBlocked,
    closed,
}

export enum AdminActionTypes {
    blockUser,
    blockIp,
    banUserComment,
}

export interface AdminAction {
    id: string;
    type: AdminActionTypes;
    operator: string;
    operatorName: string;
    isSuperAdmin: boolean;
    room: string;
    time: string | number;
    detail: {
        ip?: string;
        userId?: string;
    };
}

export enum CronTaskTypes {
    destroyRoom = 'destroyRoom',
    cutMusic = 'cutMusic',
}