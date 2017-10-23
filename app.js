// NPM modules
var express = require('express');
var http = require('http');
var path = require('path');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var rpn = require('request-promise');
var _filter = require('lodash').filter;
var objectAssign = require('object-assign');
var fs = require("fs");
var jsonFormat = require('json-format');
var xenvConfig = require("xenv-config");
// Local modules
var youtubeFetcher = require("sc-youtube")
var crawler = require("./crawler.js");

var poster=_sendToEndpoint//either post it to an endpoint or one of two version; can be configurated, see below;
// config specification
var appConfigSpec = {
    endpointuri: {
        env: "ENDPOINTURI",
        type: "string",
        default: "ENDPOINTURI as string"
    },
    port: {
        env: "PORT",
        type: "number",
        default: 0000
    },
    nopost: {
        env: "NOPOST",
        type: "boolean",
        default: "NOPOST as boolean"
    },
    user: {
        env: "CONTENT_USER",
        type: "string",
        default: "CONTENT_USER for target endpoint as string"
    },
    pass: {
        env: "CONTENT_PASSWORD",
        type: "string",
        default: "CONTENT_PASSWORD for target endpoint as string"
    }
};


//Express sub app definition
var app = express();
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: false
}));
app.use(cookieParser());
_configurate(app);


// TODO: make the following more elegnat using app with error
app.get('/', function (req, res, next) {
    if (app.locals.config.configOK) {
        httpAgent = new http.Agent();
        httpAgent.maxSockets = 50;
        // Fetch video from the list of channels defined in config file
        crawler.crawl(app.locals.config, youtubeFetcher, _sendToFile);
        crawler.crawl(app.locals.config, youtubeFetcher, poster);
        res.end("Crawling seems OK.")
    } else {
        res.send("Check the config!<br /> Intended config: <pre>" + JSON.stringify(objectAssign(appConfigSpec, crawler.configSpec || {}), undefined, 2) + "</pre>");
    }
});

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
});

//------------Utils


/**
 * Normalize a port into a number, string, or false.
 */

function _normalizePort(val) {
    var port = parseInt(val, 10);
    if (isNaN(port)) {
        // named pipe
        return val;
    }
    if (port >= 0) {
        // port number
        return port;
    }
    return false;
}


function _configurate(app) {
    var configSpec = objectAssign(appConfigSpec, crawler.configSpec || {});
    app.locals.config = xenvConfig(configSpec);
    console.log("------------------------",app.locals.config)
    
    app.locals.config.configOK = true;
    if(app.locals.config.nopost===true){
        //just for local debugging; no credentials needed
        delete app.locals.config.user;
        delete app.locals.config.pass;
        poster=_sendToFile;
    }
    for (prop in app.locals.config) {
        if (prop !== "configOK") {
            app.locals.config.configOK &= app.locals.config[prop] !== appConfigSpec[prop].default;
        }
    }
    app.locals.config.port = app.locals.config.port || 3000;
    app.locals.config.port = _normalizePort(app.locals.config.port)
    app.locals.config.configOK = Boolean(app.locals.config.configOK)
}

function _sendToFile(videoMetaItems) {
    
    fs.appendFile('./items.txt', JSON.stringify(videoMetaItems), 'utf8')
}

function _sendToEndpoint(videoMetaItems) {
    var requestPromises = videoMetaItems.map(function (videoMetaItem) {
        return rpn({
            method: 'POST',
            uri: app.locals.config.endpointuri,
            json: videoMetaItem,
            resolveWithFullResponse: true,
            auth: {
                user: app.locals.config.user,
                pass: app.locals.config.pass
            },
            pool: httpAgent,
            timeout: 1500,
            time: true
        }).catch();
    });
    var toResultObject = function (promise) {
        return promise
            .then(request => ({
                success: true,
                request
            }))
            .catch(request => ({
                success: false,
                request
            }));
    };
    Promise.all(requestPromises.map(toResultObject)).then(function (resultObjects) {
        var successful = _filter(resultObjects, {
            success: true
        });
        var failed = _filter(resultObjects, {
            success: false
        });
        res.send({
            successful: {
                count: successful.length,
            },
            failed: {
                count: failed.length,
            }
        });
    });
}
module.exports = app;