import {ServerListenSocketEvents} from './enums'

type B = keyof typeof ServerListenSocketEvents | 'default'

const apiFrequeryLimit: {
    [key in B]: number;
} = {
    default: 1000,
    [ServerListenSocketEvents.sendMessage]: 5000,
    [ServerListenSocketEvents.pausePlaying]: 3000,
    [ServerListenSocketEvents.startPlaying]: 3000,
    [ServerListenSocketEvents.changeProgress]: 3000,
    [ServerListenSocketEvents.switchPlayMode]: 3000,
    [ServerListenSocketEvents.voteToCutMusic]: 5000,
    [ServerListenSocketEvents.addPlayListItems]: 3000,
    [ServerListenSocketEvents.movePlayListItem]: 3000,
    [ServerListenSocketEvents.deletePlayListItems]: 3000,
    [ServerListenSocketEvents.blockPlayListItems]: 2000,
    [ServerListenSocketEvents.unblockPlayListItems]: 2000,
    [ServerListenSocketEvents.searchMedia]: 5000,
    [ServerListenSocketEvents.getMediaDetail]: 5000,
    [ServerListenSocketEvents.banUserComment]: 2000,
    [ServerListenSocketEvents.blockUser]: 2000,
    [ServerListenSocketEvents.blockUserIp]: 2000,
    [ServerListenSocketEvents.revokeAction]: 2000,
    [ServerListenSocketEvents.createRoom]: 5000,
    [ServerListenSocketEvents.destroyRoom]: 5000,
    [ServerListenSocketEvents.joinRoom]: 2000,
    [ServerListenSocketEvents.quitRoom]: 2000,
    [ServerListenSocketEvents.getRoomData]: 3000,
    [ServerListenSocketEvents.recommendRoom]: 800,
    [ServerListenSocketEvents.getEmojiList]: 800,
    [ServerListenSocketEvents.getRoomAdminActionList]: 2000,
    [ServerListenSocketEvents.disconnect]: -1,
    [ServerListenSocketEvents.withdrawlMessage]: 2000,
    [ServerListenSocketEvents.setNickName]: 2000,
    [ServerListenSocketEvents.cutUserStatus]: 2000,
    [ServerListenSocketEvents.getOnlineUserList]: 2000,
    [ServerListenSocketEvents.getRoomData]: 2000,
    [ServerListenSocketEvents.manageRoomAdmin]: 2000,
    [ServerListenSocketEvents.getRoomCoordHotData]: 2000,
    [ServerListenSocketEvents.cutMusic]: 3000,
}


export default {
    authTokenFeildName: 'authToken', // token 认证的key
    hallRoomId: 'globalRoomId',
    hallRoomToken: 'hallRoomToken',
    initNickNamePerfix: 'musicradiodefault',
    roomAutoPlayTypes: ['流行', '民谣', '电子', '古风', '乡村', '摇滚', '轻音乐', '古典'],
    apiFrequeryLimit,
}

