export default {
    routes: [
        {
            method: 'GET',
            path: '/dashboard/stats',
            handler: 'dashboard.getStats',
            config: {
                auth: false,
            },
        },
    ],
};
