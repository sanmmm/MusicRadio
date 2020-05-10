import {getConfig} from 'root/lib/tools'
import path from 'path';
import fs from 'fs';
import redisCli from 'root/lib/redis';

beforeAll(() => {
    return redisCli.select(1)
})

afterAll(() => {
    return redisCli.flushdb()
})


describe('get config tool functon', () => {
    const testDirName = '_test_get_config_dir'
    const testDirPath = path.join(__dirname, testDirName)
    const writeFile = (filePath, value) => fs.writeFileSync(path.resolve(testDirPath, filePath), value)
    const genJsFileValue = value => `
        module.exports=${JSON.stringify(value)}
    `
    require

    beforeEach(() => {
        fs.mkdirSync(testDirPath)
    })

    afterEach(() => {
        fs.rmdirSync(testDirPath, {
            recursive: true
        })
    })

    it('match default config file', () => {
        const d1 = {
            a: 1
        }
        writeFile('./a.default.js', genJsFileValue(d1))
        const d1Config = getConfig({
            filename: 'a.js',
            dir: [testDirName],
            basePath: __dirname,
            silent: true,
        })
        expect(d1Config).toEqual(d1)

        writeFile('./a.default.json', JSON.stringify(d1))
        const d1JosnConfig = getConfig({
            filename: 'a.json',
            dir: [testDirName],
            basePath: __dirname,
            silent: true,
        })
        expect(d1JosnConfig).toEqual(d1)
    })

    it('match config file', () => {
        const d1 = {
            b: 2
        }
        writeFile('./b.js', genJsFileValue(d1))
        const d1Config = getConfig({
            filename: 'b.js',
            dir: [testDirName],
            basePath: __dirname,
            silent: true,
        })
        expect(d1Config).toEqual(d1)

        writeFile('./b.json', JSON.stringify(d1))
        const d1JosnConfig = getConfig({
            filename: 'b.json',
            dir: [testDirName],
            basePath: __dirname,
            silent: true,
        })
        expect(d1JosnConfig).toEqual(d1)
    })

    it('match config/default config file with object', () => {
        const d1 = {
            a: 2
        }
        const d1Default = {
            a: 3,
            b: 2,
        }
        writeFile('./c.js', genJsFileValue(d1))
        writeFile('./c.default.js', genJsFileValue(d1Default))

        const d1Config = getConfig({
            filename: 'c.js',
            dir: [testDirName],
            basePath: __dirname,
            silent: true,
        })
        expect(d1Config).toEqual({
            ...d1Default,
            ...d1
        })

        writeFile('./c.json', JSON.stringify(d1))
        writeFile('./c.default.json', JSON.stringify(d1Default))
        const d1JosnConfig = getConfig({
            filename: 'c.json',
            dir: [testDirName],
            basePath: __dirname,
            silent: true,
        })
        expect(d1JosnConfig).toEqual({
            ...d1Default,
            ...d1
        })
    })

    it('match config/default config file with array', () => {
        const d1 = [1, 2]
        const d1Default = [3, 4]
        writeFile('./d.default.js', genJsFileValue(d1Default))
        writeFile('./d.js', genJsFileValue(d1))
        
        const d1Config = getConfig({
            filename: 'd.js',
            dir: [testDirName],
            basePath: __dirname,
            silent: true,
        })
        expect(d1Config).toEqual(d1)

        writeFile('./d.default.json', JSON.stringify(d1Default))
        const d1JosnConfig = getConfig({
            filename: 'd.json',
            dir: [testDirName],
            basePath: __dirname,
            silent: true,
        })
        expect(d1JosnConfig).toEqual(d1Default)

        writeFile('./d.json', JSON.stringify(d1))
        const d1JosnConfig2 = getConfig({
            filename: 'd.json',
            dir: [testDirName],
            basePath: __dirname,
            silent: true,
        })
        expect(d1JosnConfig2).toEqual(d1)
    })

})