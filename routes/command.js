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

function updateCategory(channel, update, msg, res) {
	if(update) {
		console.log('Update', update);
		db.users.findAndModify({
			query: { channel: channel },
			update: { $set: update }
		}, function(err, user) {
			if(err) {
				console.error(err);
			}
			if(user) {
				res.send(msg);
			} else {
				res.send('No user found for channel ' + channel);
			}
		});
	} else {
		res.send('No update provided');
	}
}

router.post('/', function(req, res) {
	console.log('Request', req.body);
	var cmd = req.body.text.match(/([^:]+):(.*)/);
	var channel = req.body.channel_id;
	var text = req.body.text;
	var update = null;

	var docs = (
		'Accepted commands starting with /bob:' +
		'\n\t help \n\t\t Shows all accepted commands' +
		'\n\t report \n\t\t Displays current budget stats' +
		'\n\t remove: [category] \n\t\t Removes expense category' +
		'\n\t add: [category] \n\t\t Adds expense category' +
		'\n\t set [category]: [budget] \n\t\t Sets category budget' +
		'\n\t reset: all \n\t\t Resets all category current values' +
		'\n\t reset: [category] \n\t\t Resets category current value' +
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

							total = total + parseInt(categoryTotal);
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
					} else {
						res.send('No user found for channel ' + channel);
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

		switch(type[0]) {
			case 'add':
				db.users.findOne({ channel: channel }, function(err, user) {
					if(err) {
						console.error(err);
					}
					if(user) {
						var msg = 'Added category: ' + value;
						var categories = user.categories;
						categories[value] = {
							budget: 0,
							current: 0
						};

						update = {};
						update['categories'] = categories;
						updateCategory(channel, update, msg, res);
					} else {
						res.send('No user found for channel ' + channel);
					}
				});
				break;
			case 'remove':
				db.users.findOne({ channel: channel }, function(err, user) {
					if(err) {
						console.error(err);
					}
					if(user) {
						var msg = 'Removed category: ' + value;
						var categories = user.categories;
						delete categories[value];

						update = {};
						update['categories'] = categories;
						updateCategory(channel, update, msg, res);
					} else {
						res.send('No user found for channel ' + channel);
					}
				});
				break;
			case 'set':
				db.users.findOne({ channel: channel }, function(err, user) {
					if(err) {
						console.error(err);
					}
					if(user) {
						if(type[1] in user.categories) {
							var category = user.categories[type[1]];
							var percent = Math.round((category.current / value) * 100);
							var msg = type[1] + ': ' + category.current + '/' + value + ' | ' + percent + '%';

							update = {};
							update['categories.' + type[1] + '.budget'] = value;
							updateCategory(channel, update, msg, res);
						} else {
							res.send('Did not find a category: ' + type[1] + '. To add a category enter `/bob add: [category]`');
						}
					} else {
						res.send('No user found for channel ' + channel);
					}
				});
				break;
			case 'reset':
				db.users.findOne({ channel: channel }, function(err, user) {
					if(err) {
						console.error(err);
					}
					if(user) {
						if(value == 'all') {
							var msg = 'Reset all categories to 0%';
							var categories = user.categories;

							for(var category in categories) {
								categories[category].current = 0;
							}

							update = {};
							update['categories'] = categories;
							updateCategory(channel, update, msg, res);
						} else {
							if(value in user.categories) {
								var msg = 'Reset ' + value + ' to 0';

								update = {};
								update['categories.' + value + '.current'] = 0;
								updateCategory(channel, update, msg, res);
							} else {
								res.send('Did not find a category: ' + value + '. To add a category enter `/bob add: [category]`');
							}
						}
					} else {
						res.send('No user found for channel ' + channel);
					}
				});
				break;
			case 'report':
				db.users.findOne({ channel: channel }, function(err, user) {
					if(err) {
						console.error(err);
					}
					if(user) {
						if(type[1] in user.categories) {
							var category = user.categories[type[1]];
							var percent = Math.round((category.current / category.budget) * 100);
							var msg = type[1] + ': ' + category.current + '/' + category.budget + ' | ' + percent + '%';
							
							res.send(msg);
						} else {
							res.send('Did not find a category: ' + type[1] + '. To add a category enter `/bob add: [category]`');
						}
					} else {
						res.send('No user found for channel ' + channel);
					}
				});
				break;
			default:
				db.users.findOne({ channel: channel }, function(err, user) {
					if(err) {
						console.error(err);
					}
					if(user) {
						if(type in user.categories) {
							var category = user.categories[type];
							var newValue = parseInt(category.current) + parseInt(value);
							var percent = Math.round((newValue / category.budget) * 100);
							var msg = type[0] + ': ' + newValue + '/' + category.budget + ' | ' + percent + '%';

							update = {};
							update['categories.' + type[0] + '.current'] = newValue;
							updateCategory(channel, update, msg, res);
						} else {
							res.send('Did not find a category: ' + type[0] + '. To add a category enter `/bob add: [category]`');
						}
					} else {
						res.send('No user found for channel ' + channel);
					}
				});
				break;
		}
	}
});

module.exports = router;