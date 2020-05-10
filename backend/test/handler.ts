import {RoomRoutineLoopTasks, UtilFuncs, DestroyRoom} from 'root/lib/handler'
import * as CronTask from 'root/lib/taskCron'
import {Room} from 'root/lib/models'
import redisCli from 'root/lib/redis';
import {CronTaskTypes} from 'root/type'

function wait (time: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, time)   
    })
}

beforeAll(() => {
    return redisCli.select(1)
})

afterAll(() => {
    return redisCli.flushdb()
})

beforeEach(() => {
    return redisCli.flushdb()
})


describe('room routine task', () => {
    it('start',async () => {
        const room = await new Room({}).save()
        for (let taskType of Object.values(RoomRoutineLoopTasks.TaskTypes)) {
            const cb = jest.fn()
            CronTask.listen(CronTaskTypes.roomRoutineTask, cb)
            await RoomRoutineLoopTasks.startRoomTask({
                taskType: taskType as any,
                period: 0.01,
                room,
            })
            await wait(100)
            expect(cb).toBeCalled()
        }
    }, 10000)

    it('stop', async () => {
        const room = await new Room({}).save()
        for (let taskType of Object.values(RoomRoutineLoopTasks.TaskTypes)) {
            const cb = jest.fn()
            CronTask.listen(CronTaskTypes.roomRoutineTask, cb)
            await RoomRoutineLoopTasks.startRoomTask({
                taskType: taskType as any,
                period: 0.1,
                room,
            })
            await wait(50)
            await RoomRoutineLoopTasks.stopRoomTask(room, taskType as any)
            await wait(100)
            expect(cb).not.toBeCalled()
        }
    })
})

describe('destroyRoomTask', () => {
    it('set destroy room task', async () => {
        const room = await new Room({}).save()
        await DestroyRoom.destroy(room, 2)
        await wait(3000)
        expect(Room.findOne(room.id)).resolves.toBe(null)
    })

    it('cancel destroy room task', async () => {
        const room = await new Room({}).save()
        await DestroyRoom.destroy(room, 2)
        await wait(1000)
        await DestroyRoom.cancelDestroy(room)
        await wait(2000)
        expect(Room.findOne(room.id)).resolves.not.toBe(null)
    })
})

describe('UtilFuncs', () => {
    it('recordFuctionArguments', async () => {
        const funKey = Date.now().toString()
        const isChanged = await UtilFuncs.recordFuctionArguments(funKey, {
            taskType: 'ok',
            period: 1,
            extraData: null,
        })
        expect(isChanged === true).toBe(true)
        const isChanged2 = await UtilFuncs.recordFuctionArguments(funKey, {
            taskType: 'ok',
            period: 1,
            extraData: null,
        })
        expect(isChanged2 === false).toBe(true)
        const isChanged3 = await UtilFuncs.recordFuctionArguments(funKey, {
            taskType: 'ok',
            period: 10,
            extraData: null,
        })
        expect(isChanged3 === true).toBe(true)
    })
})
