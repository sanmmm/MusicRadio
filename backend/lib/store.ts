import {UserRoomRecord} from 'root/type'

export const userRoomInfoMap = new Map<string, UserRoomRecord>()

export const roomHeatMap = new Map<string, number>()

export const roomJoinersMap = new Map<string, string[]>()

export const roomNormalJoinersMap = new Map<string, string[]>()

export const roomAdminsMap = new Map<string, string[]>()

export const roomUpdatedUserRecordsMap  = new Map<string, Map<string, UserRoomRecord & {isOffline?: boolean}>>()

export const modelMemberIdsMap = new Map<string, Set<string>>()

export const redisSetCache = new Map<string, Set<string>>()

export const isRedisSetCahceLoaded = new Map<string, boolean>()

export const redisSetToArrayCache = new Map<string, string[]>()

export const blockKeySet = new Set<string>()

export type RejectType = (reason?: any) => void
export type ResolveType = () => any;
export const reqBlockCallBackQueue = new Map<string, {cb: Function, resolve: ResolveType, reject: RejectType}[]>()
export function getBlockWaittingCbQueue (blockKey: string) {
    let queue = reqBlockCallBackQueue.get(blockKey)
    if (!queue) {
        queue = []
        reqBlockCallBackQueue.set(blockKey, queue)
    }
    return queue
}