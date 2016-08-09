var _ = require('lodash');
var moment = require('moment');
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var debug = require('debug')('utils');
var crypto = require('crypto');
var geoip = require('geoip-native');

var getGeoIP = function(sourceIP) {
    var retVal = null;
    if(!_.isUndefined(sourceIP)) {
        retVal = geoip.lookup(sourceIP);
        debug("GeoIP of %s return %s", sourceIP, retVal.name);
    } else {
        retVal = {'code': null, 'name': null};
        debug("GeoIP absent for %s!", sourceIP);
    };
    return retVal;
}

var JSONsave = function(basepath, source, jsonblob) {
    var fpath = basepath + "/" 
                + source + "-" 
                + moment().format('hhmmss') + ".json";
    return Promise.resolve(
        fs.writeFileAsync(fpath, JSON.stringify(jsonblob, undefined, 2))
          .then(function(result) {
              debug("written debug file %s", fpath);
              return true;
          })
    );
};

var hash = function(obj, fields) {
    if(_.isUndefined(fields))
        fields = _.keys(obj);
    var plaincnt = fields.reduce(function(memo, fname) {
        return memo += fname + "∴" + _.get(obj, fname, '…miss!') + ",";
        return memo;
    }, "");
    debug("Hashing of %s", plaincnt);
    sha1sum = crypto.createHash('sha1');
    sha1sum.update(plaincnt);
    return sha1sum.digest('hex');
};

var getPostInfo = function(tle) {

    var p = _.first(tle.content);
    var retVal = { 
        order: _.parseInt(tle.order),
        refreshId: _.parseInt(tle.refreshId),
        type: p.type
    };

    /* a couple of debug switch I'll remove or change to console.error
     * if more serious */
    switch(p.type) {
        case 'promoted':
            retVal.href = p.href.replace(/\?.*/, '');
            if(!_.startsWith('https://www.facebook'))
                debug("Problem here? (order %d)", retVal.order);
            break;
        case 'feed':
            retVal.postTime = p.publicationTime;
            break;
        case 'friendlink':
            retVal.postTime = p.publicationTime;
            retVal.activityReason = p.additionalInfo;
            if(tle.content[1].type !== "related")
                debug("Can this really happen? %j", tle);
            break;
        default:
            debug("getPostInfo fail with post.type %s", p.type);
            return null;
    }

    retVal.postId = p.href.split('&')[0]
                          .replace('=', '/')
                          .split('/')
                          .reduce(function(me, chunk) {
                              if(chunk === "photo.php?fbid")
                                  retVal.info = "photo";
                              return _.isNaN(me) ? _.parseInt(chunk) : me;
                          }, NaN);

    if(_.isNaN(retVal.postId) && retVal.type !== "promoted") {
        debug("Parsing error of TimeLineEntry %j", tle);
    }
    return retVal;
};

/* used in .reduce of postFeed API */
var processContribution = function(memo, tle) { 

    if(_.get(tle, 'what') === 'refresh') {
        memo.current = _.parseInt(tle.unique);
        memo.refreshes.push({
            refreshTime: tle.when,
            refreshId: memo.current
        });
        return memo;
    }

    var purePost = getPostInfo(tle);

    if(_.isNull(purePost)) {
        console.error("Error in parsing a received feed/post");
        console.error(JSON.stringify(tle, undefined, 2));
        return memo;
    }

    memo.timeline.push(purePost);
    return memo;
};

/* called as .map for every timeline entry */
var tLineContentClean = function(memo, ce) {

    if(_.isNull(ce) || _.isUndefined(ce))
        return memo;

    var cnte = _.omit(ce, ['utime']);
    if(!_.isUndefined(cnte['utime']))
        cnte = _.set(cnte, "etime", moment(ce.utime * 1000).format());

    if(_.isUndefined(cnte.additionalInfo) || 
      (_.size(cnte.addittionalInfo) < 3) )
        _.unset(cnte, 'additionalInfo');

    memo.push(cnte);
    return memo;
};

module.exports = {
    tLineContentClean: tLineContentClean,
    processContribution: processContribution,
    getPostInfo: getPostInfo,
    hash: hash,
    getGeoIP: getGeoIP,
    JSONsave: JSONsave
};