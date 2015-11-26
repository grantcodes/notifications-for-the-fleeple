var express = require('express');
var OAuth = require('oauth');
var spark = require('spark');
var PushBullet = require('pushbullet');
var nconf = require('nconf');

var app = express();

nconf.argv()
    .env()
    .file({ file: __dirname + '/config.json' });

var users = nconf.get('users');
var baseUrl = nconf.get('baseUrl');

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

var getUserByToken = function(token, cb) {
  var pusher = new PushBullet(token);
  pusher.me(function(err, user) {
    if (err) {
      cb(false);
    } else {
      user.token = token;
      if (users.indexOf(user) > -1) {
        // We found the user
        cb(user);
      } else {
        cb(false);
      }
    }
  });
};

var getUserByIden = function(iden, cb) {
  var foundUsers = users.filter(function(user) {
    return (user.iden == iden);
  });
  if (foundUsers.length === 1) {
    cb(foundUsers[0]);
  } else {
    cb(false);
  }
};

var notifyTheFleeple = function(message) {
    for (var i = users.length - 1; i >= 0; i--) {
        var user = users[i];
        var pusher = new PushBullet(user.token);
        pusher.note({}, 'For the Fleeple', message);
    }
};

var pollTheFleeple = function(message) {
    for (var i = users.length - 1; i >= 0; i--) {
        var user = users[i];
        var pusher = new PushBullet(user.token);
        pusher.link({}, 'For the Fleeple: ' + message, baseUrl + '/poll?iden=' + user.iden);
    }
};

spark.on('login', function() {
    console.log('logged in and running');

    spark.onEvent('fleet-bacon', function(data) {
      console.log("Bacon Event: " + data);
      pollTheFleeple('Someone is going for bacon! Click the link if you want some.');
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
      pollTheFleeple('What time is it? It\'s beer\'o\'clock! Click if you\'re coming along');
    });
});

app.get('/', function (req, res) {
  var authURL = oauth2.getAuthorizeUrl({
      redirect_uri: baseUrl + '/code',
      state: 'this is just some gobbledygook for security',
      response_type: 'code'
  });

  var body = '<a href="' + authURL + '">Login with PushBullet</a>';
  res.end(body);
});

app.get('/code', function (req, res) {
    if (req.query.code) {
        oauth2.getOAuthAccessToken(
            req.query.code,
            {
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
                    if (!users) {
                      users = [];
                    }
                    var pusher = new PushBullet(access_token);
                    pusher.me(function(err, user) {
                      if (err) {
                        res.end('Couldn\'t get your profile :(');
                      } else {
                        getUserByIden(user.iden, function(foundUser) {
                          if (!foundUser) {
                            user.token = access_token;
                            users.push(user);
                            nconf.set('users', users);
                            nconf.save();
                          } else {
                            user = foundUser;
                          }
                        });
                        res.end('<p>Awesome! You will be notified of stuff</p><p><a href="/bacon?iden=' + user.iden + '">Click here if you are getting bacon</a></p><p><a href="/unsubscribe?iden=' + user.iden + '"">Click here to unsubscribe</a></p>');
                      }
                    });
                }
        });
    } else {
        res.end('Uh oh. A code is missing');
    }
});

app.get('/poll', function (req, res) {
  if (req.query.iden) {
    getUserByIden(req.query.iden, function(user){
      if (user) {
        notifyTheFleeple(user.name + ' is in!');
        res.end('You\'re in!');
      } else {
        res.end('Uh oh!');
      }
    });
  }
});

app.get('/bacon', function (req, res) {
  if (req.query.iden) {
    getUserByIden(req.query.iden, function(user){
      if (user) {
        pollTheFleeple(user.name + ' is getting bacon. Click the link if you want some.');
        res.end('The Fleeple have been questioned');
      } else {
        res.end('Uh oh!');
      }
    });
  }
});

app.get('/unsubscribe', function (req, res) {
  if (req.query.iden) {
    getUserByIden(req.query.iden, function(user){
      if (user) {
        // We have found this user in the keys
        var i = users.indexOf(user);
        users.splice(i, 1);
        nconf.set('users', users);
        nconf.save();
      }
    });
  }
  res.end('You will no longer be notified');
});

spark.login({
  username: nconf.get('particleUsername'),
  password: nconf.get('particlePassword')
});

app.listen(nconf.get('port'));
