var request = require('request-promise');


// Module vars
var _config = {
    "apikey": "<apikey>",
    "channels": []
}

var _callbackFunc = function (_returnItems) {
    console.log(_returnItems)
    console.log("length of fetched videos:", _returnItems.length)
}


// Module private methods
/**
 * Fetching information objects for one Youtube channel id. See Youtube API: https://developers.google.com/youtube/v3/docs/channels/list
 * @param {string} channelId - The Youtube channel id as string.
 * @param {string} nextPageToken - Utility flag indicating a further page of results.
 */
function _fetchChannelVideos(channelId, nextPageToken) {
    var options = {
        method: "GET",
        uri: "https://www.googleapis.com/youtube/v3/search",
        qs: {
            part: "snippet",
            channelId: channelId,
            maxResults: 50,
            key: _config.apikey,
            order: "date"
        }
    }
    if (nextPageToken !== undefined) {
        options.qs.pageToken = nextPageToken
    }
    request(options)
        .then(function (response) {
           response = JSON.parse(response)
            var chunkedItems = [];
            response.items.map(function (item) {
                if (item.id.videoId !== undefined) {
                    chunkedItems.push(item.id.videoId);
                }
            })
            _fetchVideoList(chunkedItems)
            if (response.hasOwnProperty("nextPageToken")) {
                _fetchChannelVideos(channelId, response.nextPageToken)
            }
        })
        .catch(function (err) {
            // Something bad happened, handle the error
            console.log(err)
        })
}


/**
 * Fetching information objects from a list of Youtube video ids. See Youtube API: https://developers.google.com/youtube/v3/docs/videos/list
 * @param {Object[]} videoList - The list of video ids; each as string. List length has to be <=50.
 */

function _fetchVideoList(videoList) {
    if (videoList.length > 0) {
        var options = {
            method: "GET",
            uri: "https://www.googleapis.com/youtube/v3/videos",
            qs: {
                part: "snippet,contentDetails,status",
                id: videoList.toString(),
                key: _config.apikey
            }
        }
        request(options)
            .then(function (response) {
                    var _returnItems = JSON.parse(response).items
                   _callbackFunc(_returnItems)
            })
            .catch(function (err) {
                // Something bad happened, handle the error
                console.error(err)
            })
    } else {
        console.log("empty chunklist")
        
    }
}

// Module public methods
/**
 * 
 * @param {object} config - Simple config object containing the API key and an array of channel ids as strings. 
 * @param {function} callbackFunc - The callback that handles the response.callbackFunc 
 */
function fetch(config, callbackFunc) {
    _callbackFunc = callbackFunc || _callbackFunc
    _config = config;
    _config.channels.map(function (item) {
        _fetchChannelVideos(item)
    })
}

// Module syntax
module.exports = {
    fetch: fetch
}