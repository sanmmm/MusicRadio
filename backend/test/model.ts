import { BaseModelDef, ModelDescriptors, defineModel, Room } from 'root/lib/models'
import redisCli from 'root/lib/redis';

beforeAll(() => {
    return redisCli.select(1)
})

afterAll(() => {
    return redisCli.flushdb()
})

@ModelDescriptors.modelDecorator('test1')
class Test1 extends BaseModelDef {
    constructor(props) {
        super()
        Object.assign(this, props)
    }
    @ModelDescriptors.dynamicDecorator
    notSave: number
    @ModelDescriptors.uniqueDecorator
    unique: number

    a = 1
    b = 2
    arr = []
    obj: {
        [key: string]: any;
    }
}

const Test1Wrapper = defineModel<Test1, typeof Test1>(Test1)


describe('model:basic', () => {
    beforeAll(() => {
        return redisCli.flushdb()
    })
    let created: Test1 = null
    it('create', async () => {
        const c1 = new Test1Wrapper({
            a: 1
        })
        const res = await c1.save().catch(e => e)
        expect(res instanceof Error).not.toBe(true)
        created = c1
    })

    it('findOne', async () => {
        const find = await Test1Wrapper.findOne(created.id)
        expect(find.id).toBe(created.id)
    })

    it('find', async () => {
        const [find] = await Test1Wrapper.find([created.id])
        expect(find.id).toBe(created.id)
    })

    it('findAll', async () => {
        const res = await Test1Wrapper.find([created.id])
        expect(res instanceof Array).toBe(true)
        expect(res.length).toBe(1)
        const [find] = res
        expect(find.id).toBe(created.id)
    })

    it('remove', async () => {
        const res = await created.remove().catch(e => e)
        expect(res instanceof Error).not.toBe(true)
        expect(await Test1Wrapper.findOne(created.id)).toBe(null)
    })
})

describe('model:update', () => {
    beforeAll(() => {
        return redisCli.flushdb()
    })

    it('updateFieldValue', async () => {
        const d1 = new Test1Wrapper({
            a: 1,
        })
        await d1.save()
        expect(d1.a).toBe(1)
        d1.a = 2
        await d1.save()
        expect(d1.a).toBe(2)

        const d2 = await Test1.findOne(d1.id)
        expect(d2.a === 2).toBe(true)
        d2.a = 3
        await d2.save()
        expect(d2.a === 3).toBe(true)

        await d1.save()
        expect(d1.a === 3).toBe(true)
    })

    it('updateMultiFieldValue', async () => {
        const d1 = new Test1Wrapper({
            a: 10,
            b: 10,
        })
        await d1.save()
        expect(d1.b).toBe(10)
        expect(d1.a).toBe(10)

        const d2 = await Test1.findOne(d1.id)
        d2.a = 11
        await d2.save()
        expect(d2.a).toBe(11)

        d1.b = 11
        await d1.save()
        expect(d1.b).toBe(11)
        expect(d1.a).toBe(11)

        const d3 = await Test1.findOne(d1.id)
        expect(d3.a === 11).toBe(true)
        expect(d3.b === 11).toBe(true)
    })

    it('updateArrayFeild', async () => {
        const f1 = new Test1Wrapper({
            arr: [1, 2]
        })
        await f1.save()

        const f2 = await Test1Wrapper.findOne(f1.id)
        f2.arr.push(3)
        await f2.save()
        expect(f2.arr[2] === 3).toBe(true)

        f1.arr.pop()
        await f1.save()
        expect(f1.arr.length === 1).toBe(true)

        const f3 = await Test1Wrapper.findOne(f1.id)
        expect(f3.arr.length === 1).toBe(true)

        f3.arr = [5, 6, 7]
        await f3.save()
        expect(f3.arr).toEqual([5, 6, 7])

        const f4 = await Test1Wrapper.findOne(f1.id)
        expect(f4.arr).toEqual([5, 6, 7])
    })

    it('updatePropertyFunction', async () => {
        const h1 = new Test1Wrapper({
            obj: {
                obja1: 1
            }
        })
        await h1.save()
        h1.obj.obja1 = 2
        await h1.save()
        expect(h1.obj.obja1 === 2).toBe(false)
        expect(h1.obj.obja1 === 1).toBe(true)

        h1.obj.obja1 = 2
        h1.updateProperty('obj')
        await h1.save()
        expect(h1.obj.obja1 === 2).toBe(true)
        expect(h1.obj.obja1 === 1).toBe(false)

        const h2 = await Test1Wrapper.findOne(h1.id)
        expect(h2.obj.obja1).toBe(2)

        h1.obj = {
            k: 2
        }
        await h1.save()
        expect(h1.obj).toEqual({
            k: 2
        })

        const h3 = await Test1Wrapper.findOne(h1.id)
        expect(h3.obj).toEqual({
            k: 2
        })
    })

    it('update stamp', async () => {
        const h1 = new Test1Wrapper({})
        await h1.save()
        expect(Object.values(h1.propertiesStamp).every(i => i === 0)).toBe(true)
        h1.a = 6
        await h1.save()
        expect(h1.propertiesStamp.a).toBe(1)
    })
})

it('model:dynamic', async () => {
    beforeAll(() => {
        return redisCli.flushdb()
    })

    const c1 = new Test1({ notSave: 3 })
    await c1.save()
    const c2 = await Test1.findOne(c1.id)
    expect(c2.notSave !== 3).toBe(true)
})

describe('model:unique', () => {
    beforeAll(() => {
        return redisCli.flushdb()
    })

    it('save', async () => {
        const b1 = new Test1Wrapper({})
        b1.unique = 2
        await b1.save()
        expect(!!b1.id).toBe(true)
    })

    it('query by unique key', async () => {
        const uniqueValue = 3
        const b1 = new Test1Wrapper({})
        b1.unique = uniqueValue
        await b1.save()
        const b2 = await Test1Wrapper.findByIndex('unique', uniqueValue)
        expect(b2.id).toBe(b1.id)
        expect(b2.unique).toBe(b1.unique)
    })

    it('duplicate check', async () => {
        const uniqueValue = 4
        const b1 = new Test1Wrapper({
            unique: uniqueValue
        })
        await b1.save()
        const b2 = new Test1Wrapper({
            unique: uniqueValue
        })
        let e = null
        await b2.save().catch(saveError => e = saveError)
        expect(e instanceof Error).toBe(true)
    })

    it('remove unique index', async () => {
        const b1 = new Test1Wrapper({
            unique: 5
        })
        await b1.save()
        await b1.remove()
        const findb1 = await Test1Wrapper.findByIndex('unique', 5)
        expect(findb1).toBe(null)
        const b2 = new Test1Wrapper({
            unique: 5
        })
        const res = await b2.save().catch(e => e)
        expect(res instanceof Error).not.toBe(true)
    })

    it('modify unique key value', async () => {
        const b1 = new Test1Wrapper({
            unique: 6
        })
        await b1.save()
        b1.unique = 6.1
        await b1.save()
        expect(await Test1Wrapper.findByIndex('unique', 6)).toBe(null)
        const b2 = new Test1Wrapper({
            unique: 6
        })
        const res = await b2.save().catch(e => e)
        expect(res instanceof Error).not.toBe(true)
    })

})
