require('dotenv').config();

var express = require('express');
var path = require('path');
var bodyParser = require('body-parser');

var command = require('./routes/command.js');

var PORT = 5000;

var app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.all('*', function(req, res, next) {
    res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
     // intercept OPTIONS method
    if ('OPTIONS' == req.method) {
      res.send(200);
    }
    else {
      next();
    }
});

app.get('/', function(req, res) {
  res.send('Hello this is Bob');
});

// Router
// app.use('/command', command);

app.listen(PORT, function() {
	console.log('Server started on port: '+PORT);
});
