var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var session = require('express-session');
var bcrypt = require('bcrypt-nodejs');


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
app.use(express.static(__dirname + '/public'));

/*

//if there is a successful login

app.use(session({
  genid: function(req) {
    return geuuid();
  }
}))
is session valid?
if no, res.redirect('/login')
else next
*/



app.get('/', 
function(req, res) {
  // if (true) {
    //do whatever they want
  // } else {
    res.redirect('/login');
  // }
  // res.render('index');
  //check to see if user is signed in
    //by looking at the cookies in the header
    //if signed in, render their index
    //else, render the login page
});

app.get('/signup',
  function(req, res) {
    res.render('signup');
  });

app.get('/create', 
function(req, res) {
  res.render('index');
});

app.get('/links', 
function(req, res) {
  Links.reset().fetch().then(function(links) {
    res.send(200, links.models);
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
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        Links.create({
          url: uri,
          title: title,
          base_url: req.headers.origin
        })
        .then(function(newLink) {
          // newLink.save();
          res.send(200, newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/

app.post('/login', function(req, res) {

  var username = req.body.username;
  var password = /*salted and hashed*/(req.body.password);

  // if (username === /*correct username from db*/ && password === /*correct password from db*/) {
  //   req.session.regenerate(function() {
  //     req.session.user = username;
  //     req.redirect('/????');
  //   })
  // }
})

app.post('/signup', function(req, res) {

    if (!req.body.username || !req.body.password) {
      res.redirect('/login');
    }
 
    var username = req.body.username;
    var password = req.body.password;
    var salt = bcrypt.genSaltSync(10);
    var hash = bcrypt.hashSync(password, salt);
    console.log('user: ', username, 'password: ', password, 'salt: ', salt, 'hash: ', hash);
    //create new row in users table
      //pass in username, hash, and salt
    Users.create({
      username: username,
      hash: hash,
      salt: salt}
    ).then(function(newUser) {
      console.log(newUser);
      res.send(200, newUser);
    });

    // var userObj = db.users.findOne({ username: username, password: hash, salt: salt });
    // req.session.regenerate(function(){
    //     // req.session.user = userObj.username;
    //     res.redirect('/restricted');
    // });
 
});


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
