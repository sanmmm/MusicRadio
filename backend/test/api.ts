import {getMusicInfo, getAlbumInfo, searchMedia, getHighQualityMusicList, getPlayListInfo, } from 'root/lib/api'
import {MediaTypes} from 'root/type'
import redisCli from 'root/lib/redis';

beforeAll(() => {
    return redisCli.select(1)
})

afterAll(() => {
    return redisCli.flushdb()
})


describe('test netease api', () => {
    it('teat get music info',async () => {
        const [info] = await getMusicInfo(['65533'])
        expect(info).toMatchObject(expect.objectContaining({
            src: expect.any(String),
            lyric: expect.any(String),
            comments: expect.any(Array),
            id: expect.any(String),
            name: expect.any(String),
            artist: expect.any(String),
            album: expect.any(String),
            pic: expect.any(String),
            duration: expect.any(Number),
            free: expect.any(Boolean),
        }))
    })

    it('test get album info', () => {
        return expect(getAlbumInfo('2301158')).resolves.toMatchObject(expect.objectContaining({
            id: expect.any(String),
            name: expect.any(String),
            desc: expect.any(String),
            pic: expect.any(String),
            musicList: expect.any(Array),
        }))
    })

    it('search media/song',async () => {
        const list = await searchMedia('陈奕迅', MediaTypes.song)
        list.forEach(item => expect(item).toMatchObject( expect.objectContaining({
            id: expect.any(String),
            title: expect.any(String),
            desc: expect.any(String),
        })))
    })

    it('search media/album',async () => {
        const list = await searchMedia('陈奕迅', MediaTypes.album)
        list.forEach(item => expect(item).toMatchObject( expect.objectContaining({
            id: expect.any(String),
            title: expect.any(String),
            desc: expect.any(String),
        })))
    })

    it('getHighQualityMusicList', async () => {
        const list = await getHighQualityMusicList('流行')
        list.forEach(item => expect(item).toMatchObject( expect.objectContaining({
            id: expect.any(Number),
            name: expect.any(String),
            description: expect.any(String),
        })))
    })

    it('playlist info', () => {
        return expect(getPlayListInfo('3136952023')).resolves.toMatchObject(
            expect.objectContaining({
                id: expect.any(Number),
                name: expect.any(String),
                description: expect.any(String),
                musicList: expect.any(Array),
            })
        )
    })

})
