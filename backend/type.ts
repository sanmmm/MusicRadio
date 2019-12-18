interface Session {
    id: string;
    ip: string;
    isAuthenticated: boolean;
    user?: UserModel
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
    pausePlaying = 'pausePlaying',
    startPlaying = 'startPlaying',
    addChatListMessages = 'addChatListMessages',
    addPlayListItems = 'addPlayListItems',
    movePlayListItems = 'movePlayListItems',
    deletePlayListItems = 'deletePlayListItems',
    blockPlayListItem = 'blockPlayListItem',
    recieveRoomList = 'recieveRoomList',
    userInfoChange = 'userInfoChange',
    notification = 'notification',
    updateUserStatus = 'updateUserStatus',
}

export enum ServerListenSocketEvents {
    sendMessage = 'sendMessage',
    pausePlaying = 'pausePlaying',
    startPlaying = 'startPlaying',
    addPlayListItems = 'addPlayListItems',
    movePlayListItems = 'movePlayListItems',
    deletePlayListItems = 'deletePlayListItems',
    blockPlayListItem = 'blockPlayListItem',
    banUser = 'banUser', // 禁言
    blockUser = 'blockUser', // 封禁用户
    blockUserIp = 'blockUserIp', // 封禁ip
    revokeAction = 'revokeAction', // 管理员撤回操作
    createRoom = 'createRoom',
    joinRoom = 'joinRoom',
    quitRoom = 'quitRoom',
}

export interface StaticModelClass<T = any> {
    new (obj: Partial<T>): T;
    [key: string]: any;
    find: (ids: string[]) => Promise<T[]>;
    findOne: (id: string) => Promise<T>;
    delete: (ids: string[]) => Promise<any>;
    update: (ids: string[], cb: (item: T) => T) => Promise<T[]>;
}

export interface ModelBase {
    id: string;
    fromJson: (str: string) => this;
    toJson: () => string;
    save: () => Promise<this>;
    remove: () => Promise<this>;
}

export interface UserModel extends ModelBase {
    nowRoomId: string;
    ip: string;
}

export interface RoomModel extends ModelBase {
    isHallRoom: boolean; // 是否为大厅
    max: number;
    heat: number;
    name: string;
    nowPlayingInfo: {
        name: string;
        artist: string;
        src: string;
        lyric: string;
        pic: string;
        isPaused: boolean;
        comment: {
            content: string;
            userId: number;
            avatarUrl: string;
            nickName: string;
        };
    };
    banUsers: string[];
    blockIps: string[];
    blockUsers: string[];
}