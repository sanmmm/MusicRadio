import settings from 'settings'

export function isSuperAdmin(user) {
    return true
}

export function catchError(target, propertyName, descriptor: PropertyDescriptor): any {
    const func = descriptor.value
    return async (...args) => {
        try {
            func(...args)
        } catch (e) {
            console.error
        }
    }
}