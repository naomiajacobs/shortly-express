var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var session = require('express-session');
var bcrypt = require('bcrypt-nodejs');
var cookieParser = require('cookie-parser');


var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');


var app = express();


app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));

app.use(cookieParser());
//this is creating a session. and we can use it below when a user logins and signs up
app.use(session({
    secret: "mysecret",
    resave: true,
    saveUninitialized: true,
}));

app.use(express.static(__dirname + '/public'));

app.all('/', function(req, res, next) {
  console.log('session user is: ', req.session.user);
  // console.log('session id is: ', req.sessionID);
  if (!req.session.user) {
    res.redirect('/login');
  } else {
    next();
  }
});

app.get('/logout', function(req, res) {
  req.session.destroy(); //when we do a destroy, it destroys EVERYTHING. so that means .user property and .sessionID property
  res.redirect('/login');
});

app.get('/', function(req, res) {
  res.render('index');
});

app.get('/login', function(req, res) {
  res.render('login');
});

app.get('/signup',
  function(req, res) {
    res.render('signup');
  });

app.get('/create', 
function(req, res) {
  res.render('index');
});

/*FILTER LINKS HERE*/
app.get('/links', 
function(req, res) {

  var userid;
  var currentUser = new User({username: req.session.user}).fetch()
   .then(function(user) {
      userid = user.get('id');
      Links.fetch().then(function(links) {
      res.send(200, links.where({'user_id': userid}));
    });

   });
});


app.post('/links', 
function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      console.log('found this link: ', found);
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        var userid;
        var currentUser = new User({username: req.session.user}).fetch()
          .then(function(user) {
           userid = user.get('id');
           console.log('newly created link has user id of: ', userid);
            Links.create({
              url: uri,
              title: title,
              base_url: req.headers.origin,
              user_id: userid
            })
            .then(function(newLink) {
              res.send(200, newLink);
            });
          });

        //links.create is creating a new row in the URLs table with the specified properties below.
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/

app.post('/login', function(req, res) {

  var username = req.body.username;
  var password = req.body.password;

  //bookshelf does a check, does the user already exists in our database? if so, then do the next security check which is if the hash equals the hash in the database.
  //reset the session by calling req.session.user = username. this will reset the session so there is a new expiration date. 

  var currentUser = new User({username: username}).fetch()
    .then(function(user) {
      var salt = user.get('salt');
      var hash = bcrypt.hashSync(password, salt);
      if (user.get('hash') === hash) {
        req.session.user = username;
        res.redirect('/index');
      } else {
        res.redirect('/login');
      }
    })
    .catch(function(err) {
      res.redirect('/login');
    });
    //in promises catch is throwing all the error info here.

});

app.post('/signup', function(req, res) {

    if (!req.body.username || !req.body.password) {
      res.redirect('/login');
    }
 
    var username = req.body.username;
    var password = req.body.password;
    var salt = bcrypt.genSaltSync(10);
    var hash = bcrypt.hashSync(password, salt);

    Users.create({
      username: username,
      hash: hash,
      salt: salt}
    ).then(function(newUser) {
      req.session.user = username;
      res.redirect('/index');
    });
});

//if they click logout function(req, res) {
//   res.session.end();
// }


/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        link.set('visits', link.get('visits')+1);
        link.save().then(function() {
          return res.redirect(link.get('url'));
        });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
