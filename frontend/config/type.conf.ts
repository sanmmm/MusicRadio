declare global {
    interface Window {
        g_app: any;
    }
}

export enum MessageTypes {
    notice, // 系统通知
    advanced, // 高级弹幕， 房管，或超级管理员所发
    normal, // 普通消息
    emoji, // 表情消息
    notification, // 系统响应
    send, // 发送的消息(仅发送者本地可见)
}

export enum TipTypes {
    blockMusic, 
    unBlockMusic,
}   

export enum ChatListNoticeTypes {
    unread = 'unread',
    atSign = 'atSign',
    vote = 'vote',
}

export interface MessageItem {
    id: string;
    fromId?: string;
    from: string;
    tag?: string; // 发送者的头衔
    content: {
        text?: string;
        title?: string;
        img?: string;
        atSign?: {  // @功能
            atSignToUserName: string; // @到的人的姓名
            atSignToUserId: string; // @到的人的id
            atSignPostion: number; // @符号在消息内容中的位置
        }[]
    };
    time: string | number;
    type: MessageTypes;
}


export interface DanmuItem extends MessageItem {
    levelValue: number;
    offset: number; // 位置偏移量 如:0.34 === 34%
}

export interface PlayListItem {
    id: string; // 歌曲id
    name: string; // 歌名
    artist: string; // 演唱者
    album: string; // 专辑
    duration: number; // 时长
    from: string; // 点歌人
}

export interface RoomItem {
    pic: string;
    playing: string;
    title: string;
    heat: number;
    id: string;
    token: string;
}

export enum MediaTypes {
    song = 1, // 单曲
    album, // 专辑
}

export interface searchMediaItem {
    type: MediaTypes;
    title: string;
    desc: string;
    pic: string;
    id: string;
}

export interface EmojiItem {
    id: string;
    title: string;
    src: string;
}

export enum UserStatus {
    normal, // 普通用户
    superOfNormal, //  管理员普通用户视角
    superAdmin, //管理员
}

export interface UserInfo {
    id: string;
    status: UserStatus;
    isSuperAdmin: boolean;
    name?: string;
    ip: string;
    nowRoomId: string; // 现在所属房间（可以为空）
    nowRoomName: string;
    nowRoomToken: string;
    nowRoomPassword?: string;// 房间密码
    isRoomCreator: boolean; //  是否为所属房间的创始人
    allowComment: boolean; // 是否允许在房间内发表评论
    lastReadMessageTime: string | number;
    blockPlayItems: string[]; // 用户个人屏蔽的音乐id列表
    userRoomRecordType: UserRoomRecordTypes;
}

export enum UserRoomRecordTypes {
    others, // 普通房间人员
    normalAdmin,
    creator,
    superAdmin,
}
export interface UserRoomRecord {
    type: UserRoomRecordTypes;
    userId: string;
    userName: string;
    nowRoomId: string; // 现在所属房间（可以为空）
    nowRoomName: string; // 现在所属房间名称
    allowComment: boolean; // 是否允许在房间内发表评论
    isOffline: boolean; // 是否离线
}

export enum LocalStorageKeys {
    volume = 'volume',
    openDanmu = 'openDanmu',
} 

export enum AdminActionTypes {
    blockUser,
    blockIp,
    banUserComment,
    withdrwalMessage, // 撤回消息
    awardAdmin, // 授予房间管理员权限
    removeAdmin, // 撤销房间管理员权限
}

export interface AdminAction {
    id: string;
    type: AdminActionTypes;
    operator: string;
    operatorName: string;
    operatorUserRoomType: UserRoomRecordTypes;
    isSuperAdmin: boolean;
    room: string;
    time: string | number;
    detail: {
        ip?: string;
        userId?: string;
        userName?: string;
        message?: string;
    };
}

export class MatchedSearchValue {
    constructor (props: {
        value: string;
        startMatched: number;
        endMatched: number;
    }) {
        Object.assign(this, props)
    }
    value: string;
    startMatched: number;
    endMatched: number;
}

export type SearchResValue<T> = {
    [key in keyof T]: T[key] & MatchedSearchValue
} 

export type SearchTreeType<T> = Partial<{
    [key in keyof T]: SearchTreeType<T[key]> | boolean
}>
