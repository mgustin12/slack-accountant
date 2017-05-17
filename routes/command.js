var express = require('express');
var mongojs = require('mongojs');
var rp = require('request-promise');

var db = mongojs(process.env.MONGODB_URL, ['users']);

var router = express.Router();

function sendMessage(channel, message) {
	return {
		method: 'POST',
		uri: 'https://slack.com/api/chat.postMessage',
		form: {
			token: process.env.SLACK_TOKEN,
			channel: channel,
			text: message
		},
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		json: true
	};
}

router.post('/', function(req, res) {
	var cmd = req.body.text.match(/([^:]+):(.*)/);

	if(cmd === null) {
		switch(req.body.text) {
			case 'reset':
				rp(sendMessage('Reset budget'))
					.then(function(body) {
						console.log('Send message');
					});
				break;
			default:
				res.send('Invalid command, please refer to /bob help');
				break;
		}
	} else {
		type = cmd[1].trim().split(' ');
		value = cmd[2].trim();

		res.send('Command' + type + value);
	}

	if(update) {
		console.log(update);
	}
});

module.exports = router;