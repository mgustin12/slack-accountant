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

function updateCategory(channel, update, res) {
	if(update) {
		console.log(update);
		db.users.findAndModify({
			query: { channel: channel },
			update: { $set: update }
		}, function(err, user) {
			if(err) {
				console.error(err);
			}
			if(user) {
				res.send('Updated user');
			} else {
				res.send('No user found');
			}
		});
	} else {
		res.send('No update provided');
	}
}

router.post('/', function(req, res) {
	var cmd = req.body.text.match(/([^:]+):(.*)/);
	var channel = req.body.channel;
	var text = req.body.text;
	var update = null;

	var docs = (
		'Accepted commands starting with /bob:' +
		'\n\t help \n\t\t Shows all accepted commands' +
		'\n\t report \n\t\t Displays current budget stats' +
		'\n\t remove: [category] \n\t\t Removes expense category' +
		'\n\t add: [category] \n\t\t Adds expense category' +
		'\n\t [category]: [amount] \n\t\t Charge expense amount to category'
	);

	if(cmd === null) {
		switch(text) {
			case 'help':
				res.send(docs);
				break;
			case 'report':
				var report = '';
				db.users.findOne({ channel: channel }, function(err, user) {
					if(err) {
						console.error(err);
					}
					if(user) {
						var total = 0;
						var current = 0;
						var categoryReport = [];

						for(var category in user.categories) {
							var categoryTotal = user.categories[category].budget;
							var categoryCurrent = user.categories[category].current;
							var percent = Math.round((categoryCurrent / categoryTotal) * 100);

							total = total + categoryTotal;
							current = current + categoryCurrent;
							categoryReport.push('\n\t ' + category + ': ' + categoryCurrent + '/' + categoryTotal + ' | ' + percent + '%');
						}

						var percent = Math.round((current / total) * 100);

						report = (
							'Current Budget Stats' +
							'\n\t overall: ' + current + '/' + total + ' | ' + percent + '%' +
							categoryReport.join(' ')
						);

						res.send(report);
					}
				});
				break;
			default:
				res.send('Invalid command, please refer to /bob help');
				break;
		}
	} else {
		type = cmd[1].trim().split(' ');
		value = cmd[2].trim();

		if(type == 'add') {
			db.users.findOne({ channel: channel }, function(err, user) {
				if(err) {
					console.error(err);
				}
				if(user) {
					var categories = user.categories;
					categories[value] = {
						budget: 0,
						current: 0
					};

					update = {};
					update['categories'] = categories;
					updateCategory(channel, update, res);
				}
			});
		} else if(type == 'remove') {
			db.users.findOne({ channel: channel }, function(err, user) {
				if(err) {
					console.error(err);
				}
				if(user) {
					var categories = user.categories;
					delete categories[value];

					update = {};
					update['categories'] = categories;
					updateCategory(channel, update, res);
				}
			});
		} else {
			db.users.findOne({ channel: channel }, function(err, user) {
				if(err) {
					console.error(err);
				}
				if(user) {
					if(type in user.categories) {
						var newValue = user.categories[type].current - value;
						console.log(type[0], newValue);
						update = {};
						update['categories.' + type[0] + '.current'] = newValue;
						updateCategory(channel, update, res);
					} else {
						res.send('Did not find a category: ' + type + '. To add a category enter `/bob add: [category]`');
					}
				} else {
					res.send('Did not find user');
				}
			});
		}
	}
});

module.exports = router;