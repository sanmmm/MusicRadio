export const userRoomInfoMap = new Map<string,  {
    nowRoomId: string;
    isRoomCreator: boolean;
    isSuperAdmin: boolean;
    allowComment: boolean;
    nowRoomName: string;
}>()

export const roomHeatMap = new Map<string, number>()

export const roomJoinersMap = new Map<string, string[]>()

export const roomAdminsMap = new Map<string, string[]>()
