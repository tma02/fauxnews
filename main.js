//RmF1eCBOZXdzDQppIDwzIGJhc2U2NA==
var express = require('express');
var http = require('http');
var uuid = require('uuid');
var chance = require('chance')();
var schedule = require('node-schedule');
var moment = require('moment');

var lastUpdate = moment();
var app = express();
var trueHeadlines = {};
var fakeHeadlines = {};

app.engine('jade', require('jade').__express);
app.set('view engine', 'jade');
app.set('views', './views');

app.get('/', function(req, res) {
	var headline;
	var real = chance.bool();
    
	if (real) {
		headline = getRandomProperty(trueHeadlines);
	}
	else {
		headline = getRandomProperty(fakeHeadlines);
	}
    
    res.render('index', {
        title:         'Faux News',
        headline:      headline.title,
        url:           headline.url,
        uuid:          headline.uuid,
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

app.listen(80);
console.log("You sir, are running some pretty edgy code.");

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
	    	    //hacky stuff; sorry boss
	    	    if (e.data.url.split('://www.reddit.com').length == 2) {
	    		    return;
	    	    }
	    	    e.data.title = e.data.title.split(' | The Onion')[0];
	    	    var uuidStr = uuid.v4();
	    	    headlineArray[uuidStr] = {
                    uuid:  uuidStr,
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
    
	getRedditJson('http://www.reddit.com/r/nottheonion/.json', trueHeadlines);
	getRedditJson('http://www.reddit.com/r/theonion/.json', fakeHeadlines);
    
	lastUpdate = moment();
    
	console.log('Headlines updated: ' + lastUpdate.format());
}

function getRandomProperty(obj) {
	var keys = Object.keys(obj);
	return obj[keys[chance.integer({
        min: 0,
        max: keys.length - 1
    })]];
}

var reloadRule = new schedule.RecurrenceRule();

reloadRule.minute = 0;

var reloadJob = schedule.scheduleJob(reloadRule, function() {
	updateHeadlines();
});
