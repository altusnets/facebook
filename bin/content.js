const express = require('express');
const app = express();
const server = require('http').Server(app);
const _ = require('lodash');
const moment = require('moment');
const bodyParser = require('body-parser');
const Promise = require('bluebird');
const debug = require('debug')('fbtrex:content');
const nconf = require('nconf');
const pug = require('pug');
const cors = require('cors');
const path = require('path');

/* this is the same struct of the previous version */
const utils = require('../lib/utils');
const mongo = require('../lib/mongo');
const common = require('../lib/common');
const security = require('../lib/security');

var cfgFile = "config/content.json";
nconf.argv().env().file({ file: cfgFile })

if(nconf.get('FBTREX') !== 'production') {
    debug("Because $FBTREX is not 'production', it is assumed be 'development'");
    nconf.stores.env.readOnly = false;
    nconf.set('FBTREX', 'development');
    nconf.stores.env.readOnly = true;
} else {
    debug("Production execution!");
}

debug("using file: %s | FBTREX mode [%s]", cfgFile, nconf.get('FBTREX'));

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
app.use(bodyParser.json({limit: '30kb'}));
app.use(bodyParser.urlencoded({limit: '30kb', extended: true}));

const getAPI = require('../lib/contentAPI');

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
app.use('/js/jquery-ui', express.static( path.join(dist, 'js', 'jquery-ui') ));
app.use('/js', express.static( path.join(dist, 'js') ));
app.use('/css', express.static( path.join(dist, 'css') ));
app.use('/images', express.static( path.join(dist, 'images') ));
app.use('/fonts', express.static( path.join(dist, 'fonts') ));
app.use('/autoscroll.user.js', express.static( path.join(dist, 'autoscroll.user.js')));

/* this if someone click on 'Your Data' before opt-in */
app.get('/personal/unset/:stuff', function(req, res) {
    req.params.page = 'unset';
    return common.dispatchPromise('getPage', req, res);
});
app.get('/personal/error/:stuff', function(req, res) {
    req.params.page = 'error';
    return common.dispatchPromise('getPage', req, res);
});

/* this is the new summary page: the parameters are acquired by JS client side */
app.get('/personal/:userToken/summary', function(req, res) {
    req.params.page = 'summary';
    return common.dispatchPromise('getPage', req, res);
});
app.get('/personal/:userToken/data', function(req, res) {
    req.params.page = 'data';
    return common.dispatchPromise('getPage', req, res);
});
app.get('/personal/:userToken/specs', function(req, res) {
    req.params.page = 'specs';
    return common.dispatchPromise('getPage', req, res);
});
app.get('/personal/:userToken/gdpr', function(req, res) {
    req.params.page = 'gdpr';
    return common.dispatchPromise('getPage', req, res);
});
app.get('/personal/:userToken/stats', function(req, res) {
    req.params.page = 'stats';
    return common.dispatchPromise('getPage', req, res);
});

/* debug for admin and/or developers */
app.get('/revision/:htmlId', function(req, res) {
    req.params.page = 'revision';
    return common.dispatchPromise('getPage', req, res);
});
app.get('/verify/:timelineId', function(req, res) {
    req.params.page = 'verify';
    return common.dispatchPromise('getPage', req, res);
});

/* /impact and /aggregated are covered as static page, this 
 * is the only one which needs a special treatment */
app.get('/impact/parsers/:key?', function(req, res) {
    req.params.page = 'parsers';
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

Promise.resolve().then(function() {
  return mongo
    .count(nconf.get('schema').supporters)
    .then(function(amount) {
       debug("mongodb is running, found %d supporters", amount);
    })
    .catch(function(error) {
       console.log("mongodb is not running - check",cfgFile,"- quitting");
       process.exit(1);
    });
});

security.checkKeyIsSet();
