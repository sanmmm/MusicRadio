/**
 * 前端配置约定
 */

 export default interface ClientSettings {
    publicPath?: string; // 当且仅当客户端获取配置文件时 注入
    websiteName: string;
    socketServer: string; 
    logoText: string;
    defaultMaskImg: string;
    notAllowCreateRoom: boolean, // 是否允许创建房间
}
