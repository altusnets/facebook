module.exports = [
    /* debug API, not authenticated, not necessarly reserved */
    { 
        desc: "individual parser verification",
        route: '/api/v2/debug/html/:htmlId',
        func: require('../routes/htmlunit').unitById
    },
    {
        desc: "full timeline verification",
        route: '/api/v2/debug/:timelineId',
        func: require('../routes/htmlunit').verifyTimeline
    },
    /* RSS feed */
    {
        desc: "RSS v2 feed fetcher",
        route: '/2/feeds/:query',
        func: require('../routes/feeds').feeds,
    },
    /* health check */
    {
        desc: "Health check",
        route: '/api/health',
        func: require('../lib/common').health,
    },
    /* services status */
    {
        desc: "Service stats",
        route: '/api/v2/services',
        func: require('../routes/status').databaseStatus,
    },
    /* https://github.com/tracking-exposed/facebook/wiki/Personal-API-documentation */
    {
        desc: "Personal summary",
        route: '/api/v2/personal/:userToken/summary/:paging?',
        func: require('../routes/summary').data,
    },
    {
        desc: "Personal summary (extended)",
        route: '/api/v2/personal/:userToken/extended/:paging?',
        func: require('../routes/summary').extended,
    },
    {
        desc: "Personal CSV",
        route: '/api/v2/personal/:userToken/csv/:dayrange?',
        func: require('../routes/summary').csv,
    },
    {
        desc: "Personal Semantics",
        route: '/api/v2/personal/:userToken/semantics/:dayrange?',
        func: require('../routes/summary').semantics,
    },
    {
        desc: "Personal Stats",
        route: '/api/v2/personal/:userToken/stats/:dayrange?',
        func: require('../routes/summary').stats,
    },
    /* Collective API 
    {
        desc: "Collective stats",
        route: '/api/v2/collective/:groupLabel/stats/:dayrange?',
        func: require('./collective').stats,
    },
    {
        desc: "Collective summary",
        route: '/api/v2/collective/:groupLabel/download/:dayrange?',
        func: require('./collective').download,
    },
    */
];
