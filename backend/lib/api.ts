import got from 'got'

import redisCli from 'root/lib/redis'
import settings from 'root/settings'
import { MediaTypes } from 'root/type'

const serverUrl = settings.neteaseApiServer.replace('\/$/g', '')

namespace Utils {
    export const musicSrcCacheExpire = 60 * 4
    export const musicBaseInfoCacheExpire = 3600 * 24 * 3
    export const musicLyricCacheExpire = 3600 * 24 * 7
    export const musicCommentsChacheExpire = 3600 * 24 * 7

    export const getMusicItemBaseInfoKey = (id: string | string[]) => `musicbaseInfo:${id instanceof Array ? id.join(',') : id}`

    export function extractBaseMusicInfo(item) {
        return {
            id: item.id + '',
            name: item.name,
            artist: item.ar.map(ar => ar.name).join('/'),
            album: item.al.name,
            pic: item.al.picUrl,
            duration: Math.ceil(item.dt / 1000),
            free: item.fee !== 1
        }
    }

    export const albumInfoCacheExpire = 3600 * 24 * 30

    export const searchCacheExpire = 3600 * 1

    export const MediaTypesToValue = {
        [MediaTypes.album]: 10,
        [MediaTypes.song]: 1,
    }

}

export async function getMusicInfo(ids: string[]) {
    const baseInfoArr = await getMusicBaseInfo(ids)

    const srcArr = await redisCli.tryGet(`musicsrc${ids.join(',')}`, async () => {
        const reqRes = await got.get(serverUrl + '/song/url', {
            json: true,
            query: {
                id: ids
            }
        });
        return (reqRes.body.data as any[]).map(item => {
            return item.url as string
        })
    }, Utils.musicSrcCacheExpire)

    return Promise.all(baseInfoArr.map(async (item, index) => {
        const comments = await redisCli.tryGet(`musiccomments:${item.id}`, async () => {
            const reqRes = await got.get(serverUrl + '/comment/hot', {
                query: {
                    id: item.id,
                    type: 0,
                },
                json: true
            })
            return (reqRes.body.hotComments as any[]).map(item => {
                const { user: { userId, avatarUrl, nickname: nickName }, content } = item
                return {
                    userId,
                    avatarUrl,
                    nickName,
                    content
                }
            })
        }, Utils.musicCommentsChacheExpire)

        const lyric = await redisCli.tryGet(`musiclyric:${item.id}`, async () => {
            const reqRes = await got.get(serverUrl + '/lyric', {
                query: {
                    id: item.id,
                },
                json: true
            })
            return reqRes.body.lrc && reqRes.body.lrc.lyric
        }, Utils.musicLyricCacheExpire)
        return {
            ...item,
            src: srcArr[index],
            lyric,
            comments
        }
    }))

}

export async function getAlbumInfo(id: string) {
    return redisCli.tryGet(`albumn:${id}`, async (cacheKey) => {
        const reqRes = await got.get(serverUrl + '/album', {
            json: true,
            query: {
                id
            }
        })
        const { songs, album } = reqRes.body

        const musicList = await Promise.all((songs as any[]).map(async s => {
            const info = Utils.extractBaseMusicInfo(s)
            await redisCli.tryGet(Utils.getMusicItemBaseInfoKey(info.id), () => {
                return [info]
            }, Utils.musicBaseInfoCacheExpire, [cacheKey])
            return info
        }))
        const albumInfo = {
            id: album.id + '',
            name: album.name,
            desc: album.description,
            pic: album.picUrl,
            musicList,
        }
        return albumInfo
    }, Utils.albumInfoCacheExpire)
}

export async function searchMedia(searchStr: string, type: MediaTypes) {
    return redisCli.tryGet(`musicsearch:${searchStr}:${type}`, async (searchCacheKey) => {
        const reqRes = await got.get(serverUrl + '/search', {
            json: true,
            query: {
                type: Utils.MediaTypesToValue[type],
                keywords: searchStr
            }
        })
        const result = reqRes.body.result
        return ((result.songs || result.albums) as any[]).map((item) => {
            const baseInfo = {
                type,
                id: item.id + '',
                title: item.name,
            }
            const artistStr = item.artists.map(item => item.name).join('/')
            return type === MediaTypes.album ? {
                ...baseInfo,
                pic: item.picUrl,
                desc: artistStr,
            } : {
                    ...baseInfo,
                    desc: `《${item.album.name}》-${artistStr}`
                }
        })
    }, Utils.searchCacheExpire)
}

export function getMusicBaseInfo(id: string[]) {
    return redisCli.tryGet(Utils.getMusicItemBaseInfoKey(id), async (cacheKey) => {
        const reqRes = await got.get(serverUrl + '/song/detail', {
            json: true,
            query: {
                ids: id
            }
        })
        const { songs, privileges } = reqRes.body as { songs: any[], privileges: any[] }
        return Promise.all(songs.map(async s => {
            const info = Utils.extractBaseMusicInfo(s)
            redisCli.tryGet(Utils.getMusicItemBaseInfoKey(info.id), () => {
                return [info]
            }, Utils.musicBaseInfoCacheExpire, [cacheKey])
            return info
        }))
    }, Utils.musicBaseInfoCacheExpire)
}

export function getPlayListInfo (playListId: string) {
    return redisCli.tryGet(`playlistDetail:${playListId}`, async (cacheKey) => {
        const reqRes = await got.get(serverUrl + '/playlist/detail', {
            json: true,
            query: {
                id: playListId,
            }
        })
        const {playlist} = reqRes.body
        const {name, description, id, tracks} = playlist
        const musicList = await Promise.all((tracks as any[]).map(async item => {
            const info = Utils.extractBaseMusicInfo(item)
            await redisCli.tryGet(Utils.getMusicItemBaseInfoKey(item.id), () => {
                return [
                    info
                ]
            }, Utils.musicBaseInfoCacheExpire, [cacheKey])
            return info
        }))
        return {
            name,
            description,
            id,
            musicList,
        }
    }, 3600 * 24)
}

export function getHighQualityMusicList (cat: string) {
    return redisCli.tryGet(`highquality:${cat}`, async (cacheKey) => {
        const reqRes = await got.get(serverUrl + '/top/playlist/highquality', {
            json: true,
            query: {
                cat,
                limit: 5
            }
        })
        const {playlists} = reqRes.body
        return (playlists as any[]).map(item => {
            const {name, description, id} = item
            return {
                name,
                description,
                id,
            }
        })
    }, 3600 * 24)
}

async function test() {
    // console.log((await getMusicInfo(['347230']))[0])
    // console.log(await getAlbumInfo('2301158'))
    // console.log(await searchMusic('许嵩', MediaTypes.album))
    // console.log(await getPlayListInfo('24381616'))
    // console.log(await getHighQualityMusicList('流行'))
}

test()
