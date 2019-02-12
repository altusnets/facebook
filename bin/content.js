const express = require('express');
const app = express();
const server = require('http').Server(app);
const _ = require('lodash');
const moment = require('moment');
const bodyParser = require('body-parser');
const Promise = require('bluebird');
const mongodb = Promise.promisifyAll(require('mongodb'));
const debug = require('debug')('fbtrex:content');
const nconf = require('nconf');
const pug = require('pug');
const cors = require('cors');
const path = require('path');

/* this is the same struct of the previous version */
const utils = require('../lib/utils');
const mongo = require('../lib/mongo');
const common = require('../lib/common');

var cfgFile = "config/content.json";
nconf.argv().env().file({ file: cfgFile })

if(nconf.get('FBTREX') !== 'production') {
    debug("Because $FBTREX is not 'production', it is assumed be 'development'");
    nconf.stores.env.readOnly = false;
    nconf.set('FBTREX', 'development');
    nconf.stores.env.readOnly = true;
    nconf.set('FBTREX')
}
debug("using file: %s FBTREX mode [%s]", cfgFile, nconf.get('FBTREX'));

if(!nconf.get('interface') || !nconf.get('port') ||  !nconf.get('schema') ) {
    console.log("Missing configuration essential (interface, post, schema)");
    process.exit(1);
}

/* configuration for elasticsearch */
const echoes = require('../lib/echoes');
echoes.addEcho("elasticsearch");
echoes.setDefaultEcho("elasticsearch");

/* binding of express server */
server.listen(nconf.get('port'), nconf.get('interface'));
debug("Listening on http://%s:%s", nconf.get('interface'), nconf.get('port'));
/* configuration of express4 */
app.use(cors());
app.use(bodyParser.json({limit: '1kb'}));
app.use(bodyParser.urlencoded({limit: '1kb', extended: true}));

const getAPI = [
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
        desc: "RSS feed fetcher",
        route: '/feeds/:query',
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

_.each(getAPI, function(o) {
    app.get(o.route, function(req, res) {
        return common.serveRequest(o.desc, o.func, req, res);
    });
});

/* the directory from where we serve static contents */
const dist = path.join(__dirname, '..', 'dist');

/* static files, independent by the API versioning */
app.get('/favicon.ico', function(req, res) {
    res.sendFile( path.join(dist, 'favicon.ico') );
});
app.get('/robots.txt', function(req, res) {
    res.sendFile( path.join(dist, 'robots.txt') );
});

/* development: the local JS are pick w/out "npm run build" every time, and
 * our locally developed scripts stay in /js/local */
if(nconf.get('FBTREX') === 'development') {
    debug("serving /js/local from %s instead of dist",
        path.join(__dirname, '..', 'sections/webscripts') );
    app.use('/js/local', express.static( path.join(__dirname, '..', 'sections/webscripts') ));
} else {
    app.use('/js/local', express.static( path.join(dist, 'js', 'local') ));
}

/* catch the other 'vendor' script in /js */
app.use('/js', express.static( path.join(dist, 'js') ));
app.use('/css', express.static( path.join(dist, 'css') ));
app.use('/images', express.static( path.join(dist, 'images') ));
app.use('/fonts', express.static( path.join(dist, 'fonts') ));
app.use('/autoscroll.user.js', express.static( path.join(dist, 'autoscroll.user.js')));

// TODO do conversion here too
/* this if someone click on 'Your Data' before opt-in */
app.get('/personal/unset/:stuff', function(req, res) {
    req.params.page = 'unset';
    return common.dispatchPromise('getPage', req, res);
});
app.get('/personal/error/:stuff', function(req, res) {
    req.params.page = 'error';
    return common.dispatchPromise('getPage', req, res);
});

/* this is the new summary page */
app.get('/personal/:userToken', function(req, res) {
    return common.dispatchPromise('getSummaryPage', req, res);
});

/* special pages: the parameters are acquired by JS client side */
app.get('/personal/:userId/:detail', function(req, res) {
    req.params.page = 'personal';
    return common.dispatchPromise('getPage', req, res);
});
app.get('/revision/:htmlId', function(req, res) {
    req.params.page = 'revision';
    return common.dispatchPromise('getPage', req, res);
});
app.get('/verify/:timelineId', function(req, res) {
    req.params.page = 'verify';
    return common.dispatchPromise('getPage', req, res);
});

/* project sub section */
app.get('/project/:projectPage', function(req, res) {
    req.params.page = 'project/' + req.params.projectPage;
    return common.dispatchPromise('getPage', req, res);
});

/* last one, page name catch-all */
app.get('/:page*', function(req, res) {
    return common.dispatchPromise('getPage', req, res);
});
/* true last */
app.get('/', function(req, res) {
    return common.dispatchPromise('getPage', req, res);
});
