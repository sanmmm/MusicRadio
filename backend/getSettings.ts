import {getConfig} from 'root/lib/tools'
import {Settings, EmojiData, BlockMusicList, BlockWordList, BitSymbols, ClientSettings} from 'root/default/configs.type'

const basePath = __dirname

const settings = getConfig<Settings>({
    filename: 'settings.js',
    basePath,
    dir: ['.', './config', './default'],
    silent: true,
})

export default settings


export const emojiData = getConfig<EmojiData>({
    filename: 'emojiData.json',
    basePath,
    dir: ['.', './config', './default'],
    silent: true,
})

export const blockMusic = getConfig<BlockMusicList>({
    filename: 'blockMusic.json',
    basePath,
    dir: ['.', './config', './default'],
    silent: true,
})

export const blockWords = getConfig<BlockWordList>({
    filename: 'blockWords.json',
    basePath,
    dir: ['.', './config', './default'],
    silent: true,
})

export const bitSymbols = getConfig<BitSymbols>({
    filename: 'bitSymbols.json',
    basePath,
    dir: ['.', './config', './default'],
    silent: true,
})

export const clientSettings = getConfig<ClientSettings>({
    filename: 'clientSettings.js',
    silent: true,
    basePath,
    dir: ['.', './default', './config'],
})
