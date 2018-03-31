require('./arrayIncludesPolyfill.js');

var express = require('express');
var http = require('https');
var uuid = require('uuid');
var chance = require('chance').Chance();
var crypto = require('crypto');
var schedule = require('node-schedule');
var moment = require('moment');

var lastUpdate = moment();
var app = express();
var trueHeadlines = {};
var fakeHeadlines = {};

var readTrueHeadlines = {};
var readFakeHeadlines = {};
var scores = {};

app.use(require('cookie-parser')());

app.engine('jade', require('jade').__express);
app.set('view engine', 'jade');
app.set('views', './views');

app.get('/', function(req, res) {
    req.cookies = req.cookies || {};
    var cid = req.cookies.cid;
    var headline;
    var real = chance.bool();

    if (real) {
        headline = getRandomProperty(real, trueHeadlines, cid);
    }
    else {
        headline = getRandomProperty(real, fakeHeadlines, cid);
    }

    res.render('index', {
        title:         'Faux News',
        headline:      headline.title,
        url:           headline.url,
        uuid:          headline.uuid,
        cid:           cid || uuid(),
        updateTimeAgo: lastUpdate.fromNow(),
        isPerm:        false,
        isReal:        real
    });
});

app.get('/h/*', function(req, res) {
    var trueKeys = Object.keys(trueHeadlines);
    var fakeKeys = Object.keys(fakeHeadlines);
    var headline;

    if (trueKeys.indexOf(req.params[0]) != -1) {
        headline = trueHeadlines[req.params[0]];
    }
    else if (fakeKeys.indexOf(req.params[0]) != -1) {
        headline = fakeHeadlines[req.params[0]];
    }
    else {
        res.render('error', {
            title:        'Faux News',
            errorTitle:   'Headline not found',
            errorMessage: 'This headline is either expired or has just never existed!'
        });
        return;
    }

    res.render('index', {
        title:         'Faux News',
        headline:      headline.title,
        url:           headline.url,
        uuid:          headline.uuid,
        updateTimeAgo: lastUpdate.fromNow(),
        isPerm:        true,
        isReal:        trueKeys.indexOf(req.params[0]) != -1
    });
});

app.get('/.json', function(req, res) {
    res.send({
        trueHeadlines: trueHeadlines,
        fakeHeadlines: fakeHeadlines
    });
});

app.get('/assets/*', function(req, res) {
    res.sendFile(__dirname + '/assets/' + req.params[0]);
});

app.listen(process.env.PORT || 80);

updateHeadlines();

function getRedditJson(url, headlineArray) {
    http.get(url, function(res) {
        var body = '';
            res.on('data', function(chunk) {
            body += chunk;
        });
        res.on('end', function() {
            var jsonRes = JSON.parse(body);
            jsonRes.data.children.forEach(function(e) {
                if (e.data.url.split('://www.reddit.com').length == 2) {
                    return;
                }
                // clean up title a little
                e.data.title = e.data.title.split(' | The Onion')[0];
                e.data.title = e.data.title.split(': ').slice(-1)[0].trim();
                var hashStr = crypto.createHash("md5").update(e.data.title + e.data.url).digest("hex");
                headlineArray[hashStr] = {
                    uuid:  hashStr,
                    title: e.data.title,
                    url:   e.data.url
                };
            });
        });
    }).on('error', function(e) {
        console.log("Error while getting headlines: " + e.message);
        console.log("Retrying...");
        getRedditJson(url, headlineArray);
    });
}

function updateHeadlines() {
    trueHeadlines = {};
    fakeHeadlines = {};

    getRedditJson('https://www.reddit.com/r/nottheonion/.json', trueHeadlines);
    getRedditJson('https://www.reddit.com/r/theonion/.json', fakeHeadlines);

    lastUpdate = moment();

    console.log('Headlines updated: ' + lastUpdate.format());
}

function getRandomProperty(real, obj, cid) {
    var keys = Object.keys(obj);
    var i = chance.integer({
        min: 0,
        max: keys.length - 1
    });
    if (real) {
        readTrueHeadlines[cid] = readTrueHeadlines[cid] || [];
        if (readTrueHeadlines[cid].length < keys.length) {
            while (readTrueHeadlines[cid].includes(i)) {
                i = chance.integer({
                    min: 0,
                    max: keys.length - 1
                });
            }
            readTrueHeadlines[cid].push(i);
        }
        else {
            readTrueHeadlines[cid] = [];
        }
    }
    else if (!real) {
        readFakeHeadlines[cid] = readFakeHeadlines[cid] || [];
        if (readFakeHeadlines[cid].length < keys.length) {
            while (readFakeHeadlines[cid].includes(i)) {
                i = chance.integer({
                    min: 0,
                    max: keys.length - 1
                });
            }
            readFakeHeadlines[cid].push(i);
        }
        else {
            readFakeHeadlines[cid] = [];
        }
    }
    return obj[keys[i]];
}

var reloadRule = new schedule.RecurrenceRule();

reloadRule.minute = 0;

var reloadJob = schedule.scheduleJob(reloadRule, function() {
    updateHeadlines();
});
