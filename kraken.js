var request		= require('request-promise');
var crypto		= require('crypto');
var querystring	= require('querystring');

/**
 * KrakenClient connects to the Kraken.com API
 * @param {String} key    API Key
 * @param {String} secret API Secret
 * @param {String} [otp]  Two-factor password (optional) (also, doesn't work)
 */
function KrakenClient(key, secret, otp) {
	var self = this;

	var config = {
		url: 'https://api.kraken.com',
		version: '0',
		key: key,
		secret: secret,
		otp: otp,
		timeoutMS: 5000
	};

	/**
	 * This method makes a public or private API request.
	 * @param  {String}   method   The API method (public or private)
	 * @param  {Object}   params   Arguments to pass to the api call
	 * @return {Object}            The request object
	 */
	function api(method, params) {
		var methods = {
			public: ['Time', 'Assets', 'AssetPairs', 'Ticker', 'Depth', 'Trades', 'Spread', 'OHLC'],
			private: ['Balance', 'TradeBalance', 'OpenOrders', 'ClosedOrders', 'QueryOrders', 'TradesHistory', 'QueryTrades', 'OpenPositions', 'Ledgers', 'QueryLedgers', 'TradeVolume', 'AddOrder', 'CancelOrder', 'DepositMethods', 'DepositAddresses', 'DepositStatus', 'WithdrawInfo', 'Withdraw', 'WithdrawStatus', 'WithdrawCancel']
		};
		if(methods.public.indexOf(method) !== -1) {
			return publicMethod(method, params);
		}
		else if(methods.private.indexOf(method) !== -1) {
			return privateMethod(method, params);
		}
		else {
			throw new Error(method + ' is not a valid API method.');
		}
	}

	/**
	 * This method makes a public API request.
	 * @param  {String}   method   The API method (public or private)
	 * @param  {Object}   params   Arguments to pass to the api call
	 * @return {Object}            The request object
	 */
	function publicMethod(method, params) {
		params = params || {};

		var path	= '/' + config.version + '/public/' + method;
		var url		= config.url + path;

		return rawRequest(url, {}, params);
	}

	/**
	 * This method makes a private API request.
	 * @param  {String}   method   The API method (public or private)
	 * @param  {Object}   params   Arguments to pass to the api call
	 * @return {Object}            The request object
	 */
	function privateMethod(method, params) {
		params = params || {};

		var path	= '/' + config.version + '/private/' + method;
		var url		= config.url + path;

		if(!params.nonce) {
			params.nonce = new Date() * 1000; // spoof microsecond
		}

		if(config.otp !== undefined) {
			params.otp = config.otp;
		}

		var signature = getMessageSignature(path, params, params.nonce);

		var headers = {
			'API-Key': config.key,
			'API-Sign': signature
		};

		return rawRequest(url, headers, params);
	}

	/**
	 * This method returns a signature for a request as a Base64-encoded string
	 * @param  {String}  path    The relative URL path for the request
	 * @param  {Object}  request The POST body
	 * @param  {Integer} nonce   A unique, incrementing integer
	 * @return {String}          The request signature
	 */
	function getMessageSignature(path, request, nonce) {
		var message	= querystring.stringify(request);
		var secret	= new Buffer(config.secret, 'base64');
		var hash	= new crypto.createHash('sha256');
		var hmac	= new crypto.createHmac('sha512', secret);

		var hash_digest	= hash.update(nonce + message).digest('binary');
		var hmac_digest	= hmac.update(path + hash_digest, 'binary').digest('base64');

		return hmac_digest;
	}

	/**
	 * This method sends the actual HTTP request
	 * @param  {String}   url      The URL to make the request
	 * @param  {Object}   headers  Request headers
	 * @param  {Object}   params   POST body
	 * @return {Object}            The request object
	 */
	function rawRequest(url, headers, params) {
		// Set custom User-Agent string
		headers['User-Agent'] = 'Kraken Javascript API Client';

		var options = {
			url: url,
			method: 'POST',
			headers: headers,
			form: params,
			timeout: config.timeoutMS,
			json: true
		};

		return request.post(options)
		.then(function (response) {
			if (response.error && response.error.length) {
				var error = null;
				response.error.forEach(function(element) {
					if (element.charAt(0) === "E") {
						error = element.substr(1);
						return false;
					}
				});

				if (error) throw error;
			} else {
				return response.result;
			}
		});
	}

	self.api			= api;
	self.publicMethod	= publicMethod;
	self.privateMethod	= privateMethod;
}

module.exports = KrakenClient;
