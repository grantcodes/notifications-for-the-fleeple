var express = require('express');
var OAuth = require('oauth');
var spark = require('spark');
var PushBullet = require('pushbullet');
var nconf = require('nconf');

var app = express();

nconf.argv()
    .env()
    .file({ file: './config.json' });

var pushBulletTokens = nconf.get('pushbulletTokens');

var OAuth2 = OAuth.OAuth2;
var clientId = nconf.get('pushbulletClientId');
var clientSecret = nconf.get('pushbulletClientSecret');
var oauth2 = new OAuth2(
    clientId,
    clientSecret,
    '',
    'https://www.pushbullet.com/authorize',
    'https://api.pushbullet.com/oauth2/token',
    null
);


var notifyTheFleeple = function(message) {
    for (var i = pushBulletTokens.length - 1; i >= 0; i--) {
        var key = pushBulletTokens[i];
        var pusher = new PushBullet(key);
        console.log('push?');
        pusher.note({}, 'For the Fleeple', message, function(err, res) {
            console.log(res);
        });
    }
};

spark.on('login', function() {
    console.log('logged in and running');
    notifyTheFleeple('The server has restarted');

    spark.onEvent('fleet-bacon', function(data) {
      console.log("Bacon Event: " + data);
      notifyTheFleeple('Someone is going for bacon! Click if you want some or something?');
    });

    spark.onEvent('fleet-coffee-on', function(data) {
      console.log("Coffee Event: " + data);
      notifyTheFleeple('The coffee is on');
    });

    spark.onEvent('fleet-coffee-done', function(data) {
      console.log("Coffee Event: " + data);
      notifyTheFleeple('The coffee is ready');
    });

    spark.onEvent('fleet-beer', function(data) {
      console.log("It's beer o clock: " + data);
      notifyTheFleeple('What time is it? It\'s beer\'o\'clock!');
    });
});

app.get('/', function (req, res) {
  var authURL = oauth2.getAuthorizeUrl({
      redirect_uri: 'http://localhost:8080/code',
      state: 'this is just some gobbledygook for security',
      response_type: 'code'
  });

  var body = '<a href="' + authURL + '"> Get Code </a>';
  res.end(body);
});

app.get('/code', function (req, res) {
    if (req.query.code) {
        oauth2.getOAuthAccessToken(
            req.query.code,
            {
                // 'redirect_uri': 'http://localhost:8080/code/',

                'grant_type': 'authorization_code'
            },
            function (e, access_token, refresh_token, results){
                if (e) {
                    console.log(e);
                    res.end('It\'s all gone tits up.');
                } else if (results.error) {
                    console.log(results);
                    res.end(JSON.stringify(results));
                }
                else {
                    console.log('Obtained access_token: ', access_token);
                    if (!pushBulletTokens) {
                      pushBulletTokens = [];
                    }
                    pushBulletTokens.push(access_token);
                    nconf.set('pushbulletTokens', pushBulletTokens);
                    nconf.save();
                    res.end('Awesome! You will be notified of stuff');
                }
        });
    } else {
        res.end('Uh oh. A code is missing');
    }
});

app.listen(8080);

spark.login({username: 'richmond.grant@gmail.com', password: 'JTNWrc4lnhGa7fh9Idd4IwhAh7kRo2uu'});
