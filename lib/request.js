
/*
 * Module dependencies
 */

var OAuth = require('oauth').OAuth
  , Tuiter = module.parent.exports
  , qs = require('querystring')
	, events = require('events')
	, util = require('util')
  , config = require('./config.json');

/*
 * Stream object constructor
 */

function Stream(){
	events.EventEmitter.call(this);
}

util.inherits(Stream, events.EventEmitter);

/*
 * Auth
 *
 * @param {Obejct} params: OAuth params
 */ 

Tuiter.prototype.oauth = function(params){
  params.consumer_key = params.consumer_key || null;
  params.consumer_secret = params.consumer_secret || null;
  params.callback_url = params.callback_url || "http://localhost:3000/oauth/callback";

  this.oa = new OAuth(config.oauth.request_token_url, 
                      config.oauth.access_token_url, 
                      params.consumer_key, params.consumer_secret, 
                      config.oauth.version, 
                      null, 
                      config.oauth.method);

  this.oa.access_token_key = params.access_token_key;
  this.oa.access_token_secret = params.access_token_secret;
};

/*
 * API calls GET method
 *
 * @param {String} url: resource url
 * @param {Object} params: resource params
 * @param {Function} callback: callback funcion
 */

Tuiter.prototype.get = function(url, params, callback){
  url += (Object.keys(params).length) ? '?' : '';
  this.oa.get(url + qs.stringify(params), this.oa.access_token_key, this.oa.access_token_secret, function(err, data){
    try{
      data = JSON.parse(data);
      callback(err, data);
    } catch(e){
      callback(e, null);
    }
  });
};

/*
 * API calls POST method
 *
 * @param {String} url: resource url
 * @param {Object} params: resource params
 * @param {Function} callback: callback funcion
 */

Tuiter.prototype.post = function(url, params, callback){
  this.oa.post(url, this.oa.access_token_key, this.oa.access_token_secret, params, function(err, data){
    try{
      data = JSON.parse(data);
      callback(err, data);
    } catch(e){
      callback(e, null);
    }
  });
};

/*
 * Streaming API calls GET method
 *
 * @param {String} url: resource url
 * @param {Object} params: resource params
 * @param {Function} callback: callback funcion
 */

Tuiter.prototype.getStream = function(url, params, callback){
	var stream = new Stream();
   
  var req = this.oa.get(url + '?' + qs.stringify(params), this.oa.access_token_key, this.oa.access_token_secret);
  handleStream(req, stream, callback);
	
  return this;
};

/*
 * Streaming API calls POST method
 *
 * @param {String} url: resource url
 * @param {Object} params: resource params
 * @param {Function} callback: callback funcion
 */

Tuiter.prototype.postStream = function(url, params, callback){
	var stream = new Stream();
  var req = this.oa.post(url, this.oa.access_token_key, this.oa.access_token_secret, params);
  handleStream(req, stream, callback);
	
  return this;
};

var handleStream = function(req, stream, callback){
  var buf = '';

  req.on('response', function(res){
    res.setEncoding('utf-8');

	  callback(stream);

    checkResStatus(res.statusCode, stream);

    res.on('data', function(chunk){
      buf += chunk;
      if(buf.indexOf('\r') !== -1){
        buf = buf.slice(0, buf.length - 2);
        var arr_buf = buf.split('\r\n');
        try{
          arr_buf.forEach(function(elem){
            var json_stream = JSON.parse(elem);
            if(json_stream.delete)
              stream.emit('delete', json_stream);
            else 
              stream.emit('tweet', json_stream);
          });
        } catch(e){
          stream.emit('error', e);
        }
        buf = '';
      }
    });

    res.on('end', function(){
      stream.destroy();
      delete stream;
    });

    stream.on('end', function(){
      res.end();
    });

  });
  req.end();

	req.on('error', function(err){
    callback(stream);
    stream.emit('error', err);
	});

};

/*
 * Check response status code
 *
 * @param {Number} status
 * @param {Object} stream
 */

var checkResStatus = function(status, stream){
  if(status >= 400){
    if(config.error[status]){
      stream.emit('error',{code: status, definition: config.error[status].definition, description: config.error[status].description});
    } else {
      stream.emit('error',{code: status, definition: 'Unrecognized error', description: 'Sorry. We dont know the kind of error. Check Twitter docs: https://dev.twitter.com/docs/error-codes-responses'});
    }
  }
}
