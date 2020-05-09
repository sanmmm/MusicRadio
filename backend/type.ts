import { NowPlayingStatus, RoomMusicPlayMode } from 'global/common/enums'

export interface SessionStoreData {
    userId: string;
    defaultUserId: string;
}

export interface Session {
    id: string;
    storeData: SessionStoreData;
    ip: string;
    isAuthenticated: boolean;
    user?: UserModel;
    login: (user: UserModel) => Promise<any>;
    logOut: () => Promise<any>;
    load: () => Promise<any>;
}

interface InjectConfigs {
    isProductionMode: boolean;
    staticPath: string;
    appendConfigFileDir?: string; // 配置文件所在文件路径
    sessionType: keyof typeof SessionTypes | string;
}
declare global {
    var hallRoomId: string;
    var injectedConfigs: InjectConfigs
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
            injectedConfigs: InjectConfigs;
        }
    }
}

export enum SessionTypes { ip, cookie, token }

export interface StaticModelClass<T = any> {
    new(obj?: Partial<T>): T;
    [key: string]: any;
    _modelName: string;
    find: (ids: string[]) => Promise<T[]>;
    findOne: (id: string) => Promise<T>;
    findAll: <U extends boolean>(onlyId?: U) => Promise<U extends true ? string[] : T[]>;
    findByIndex: (feildName: string, value: any) => Promise<T>;
    delete: (ids: string[]) => Promise<any>;
    update: (ids: string[], cb: (item: T) => T) => Promise<T[]>;
}

export interface ModelBase {
    id: string;
    createAt: string;
    updateProperty: (p: keyof this) => this; 
    save: () => Promise<this>;
    remove: () => Promise<this>;
}

export enum UserStatus {
    normal, // 普通用户
    superOfNormal, //  管理员普通用户视角
    superAdmin, //管理员
}

export interface UserModel extends ModelBase {
    readonly isSuperAdmin: boolean;
    status: UserStatus;
    name?: string;
    ip: string;
    blockPlayItems: string[]; // 用户个人屏蔽的音乐id列表
    createdRoom: string; // 创建的房间id
    managedRoom: string; // 管理的房间id
    readonly append: UserRoomRecord
    allowComment: boolean; // 是否允许在房间内发表评论
}

export enum RoomTypes {
    hallRoom, // 大厅
    system, // 管理员创建的系统托管的房间
    personal, // 个人创建的房间
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
    nowRoomToken: string; // 房间token标识
    nowRoomId: string; // 现在所属房间（可以为空）
    nowRoomName: string; // 现在所属房间名称
    nowRoomPassword: string; // 所属房间密码 （仅超级管理员,房间创建者/管理员可见）
    allowComment: boolean; // 是否允许在房间内发表评论
}

export interface RoomModel extends ModelBase {
    creator: string; // 创建者id
    status: RoomStatus; // 
    isPublic: boolean;
    readonly isHallRoom: boolean; // 是否为大厅
    type: RoomTypes;
    max: number;
    readonly heat: number;
    name: string;
    nowPlayingInfo: NowPlayingInfo;
    readonly playMode: RoomMusicPlayMode;
    playModeInfo: {
        mode: RoomMusicPlayMode;
        autoPlayType?: string;
    };
    readonly joiners: string[];
    readonly normalJoiners: string[];
    readonly admins: string[];
    banUsers: string[];
    blockIps: string[];
    blockUsers: string[];
    messageHistory: MessageItem[];
    playList: PlayListItem[];
    adminActions: AdminAction[];
    vote?: {
        id: string | number;
        musicId: string;
        agreeUids: string[];
        disagreeUids: string[];
    };
    quit: (user: UserModel) => any;
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
        atSign?: {  // @功能
            atSignToUserName: string; // @到的人的姓名
            atSignToUserId: string; // @到的人的id
            atSignPostion: number; // @符号在消息内容中的位置
        }[];
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
    from?: string; // 点歌人
    fromId?: string; // 点歌人id
}

export enum MediaTypes {
    song = 1, // 单曲
    album, // 专辑
}
export enum AdminActionTypes {
    blockUser, //屏蔽用户
    blockIp, // 屏蔽ip
    banUserComment, // 禁言
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
    room: string;
    time: string | number;
    detail: {
        ip?: string;
        userName?: string;
        userId?: string;
        message?: string;
    };
}

export enum CronTaskTypes {
    destroyRoom = 'destroyRoom',
    cutMusic = 'cutMusic',
    roomRoutineTask = 'roomRoutineTask',
    roomIpDataTask = 'roomIpDataTask',
}

export interface NowPlayingInfo {
    id: string;
    name: string;
    artist: string;
    src?: string;
    lyric?: string;
    pic?: string;
    progress: number;
    endAt: number; // 结束时间戳 秒
    duration: number; // 秒
    status: NowPlayingStatus; // 状态值
    pausedAt?: number; // 暂停时间 秒
    timestamp: number, // 信息更新服务端时间戳 毫秒
    comment?: {
        content: string;
        userId: number;
        avatarUrl: string;
        nickName: string;
    };
}