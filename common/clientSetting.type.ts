/**
 * 前端配置约定
 */

 export default interface ClientSettings {
    websiteName: string;
    socketServer: string; 
    logoText: string;
    defaultMaskImg: string;
    notAllowCreateRoom: boolean, // 是否允许创建房间
}
