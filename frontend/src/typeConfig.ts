export enum MessageTypes {
    notice, // 系统通知
    advanced, // 高级弹幕， 房管，或超级管理员所发
    normal, // 普通消息
    emoji, // 表情消息
    send, // 发送的消息(仅发送者本地可见)
    response, // 系统响应
}

export enum TipTypes {
    blockMusic, 
    unBlockMusic,
}   

export interface MessageItem {
    fromId?: string;
    from: string;
    tag?: string; // 发送者的头衔
    content: {
        text?: string;
        title?: string;
        img?: string;
    };
    time: string;
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
    isBlock: boolean; // 是否被屏蔽
}


export interface RoomItem {
    pic: string;
    playing: string;
    title: string;
    heat: number;
    id: string;
}

export enum MediaTypes {
    song = 1, // 单曲
    album, // 专辑
}

export interface SearchMusicItem {
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
