export const dva = {
    config: {
        onError(e) {
            e.preventDefault()
            console.error('dva error:', e.message);
        },
    },
    plugins: [
        // require('dva-logger')(),
    ],
};