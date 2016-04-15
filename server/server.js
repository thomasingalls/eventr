//////////////////////////////////////////////
//Server Dependencies
//////////////////////////////////////////////
var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var _ = require('underscore');
var mysql = require('promise-mysql');
// var Promise = require('bluebird'); // unused for now, might used later on
// io.emitAsync = Promise.promisify(io.emit); // unused for now, might used later on
var util = require('./utilities');
var jwt = require('jwt-simple');

//Modifiable Settings
var port = 8080;

//Temp Authentication ///////////////////////
var loggedIn = {};

/////////////////////////////////////////////
//Database
/////////////////////////////////////////////
var db;

mysql.createConnection({
  host: 'localhost',
  user: 'root',
  database: 'eventr',
}).then(function(database){
  db = database;
  console.log('successful connection');
});

//////////////////////////////////////////////
///Express Controllers
//////////////////////////////////////////////

app.use(express.static(__dirname + '/../client'));

//////////////////////////////////////////////
///Socket Controllers
//////////////////////////////////////////////

//Controllers -> might need to move someplace els
io.on('connection', function(socket) {

  //Signup Listener
  socket.on('signup', function(signupData) {
    var newUser = {
      username: signupData.username,
      email: signupData.email,
      password: signupData.password,
      created_at: util.mysqlDatetime(),   //need to be reformatted -> currently hardcoded
    };
    db.query("INSERT INTO users SET ?" , newUser)
      .then(function(packet) {
        // Let's encode with the email for now. Encode with the user object if have time.
        var token = jwt.encode(newUser.email, 'secret');

        loggedIn[signupData.email] = socket.id;
        socket.emit('signupSuccess', token);
      })
      .catch(function(error) {
        console.error(error);
        if (error.errno === 1062) {
          socket.emit('signupUserExists');
        }
        //ADD OTHER ERROR SCENARIOS HERE!
      });
  });


  //Login Listener
  socket.on('login', function(loginData) {
    //save into socket loggedIn user array
    db.query('SELECT password FROM users WHERE email = ?', loginData.email)
      .then(function(packet){
        if (data[0].password === loginData.password) {
          // Let's encode with the email for now. Encode with the user object if have time.
          var token = jwt.encode(loginData.email, 'secret');

          loggedIn[loginData.email] = socket.id;
          socket.emit('loginSuccess', token);
        } else {
          socket.emit('loginWrongPassword');
        }
      })
      .catch(function(error) {
        console.error(error);
        socket.emit('loginUserDoesNotExist');
      });
  });

  //Logout Listener
  socket.on('logout', function() {
    // Delete token from client
    socket.emit('logoutSuccess');

    // Close socket connection
    for (var key in loggedIn) {
      if (loggedIn[key] === socket.id) {
        delete loggedIn[key];
      }
    }
  });


  ////createEvent View
  socket.on('addEvent', function(data) {
    //Store data into database;

    var userEmail = util.findEmail(socket.id, loggedIn);

    var event = {
        created_at: util.mysqlDatetime(),
        updated_at: util.mysqlDatetime(),
        event_name: data.name,
        response_deadline: data.response_deadline,
        total_cost: data.cost,
        event_host: util.findUser(db, userEmail),
    };

    db.query('INSERT INTO events SET ?', event, function(err, data) {
      if (err) {
        console.log('failing at server INSERT Call', err);
        return;
      };

    });
  });

  //util.eventBroadcast(io, db, event, loggedIn, data);

});


/////////////////////////////////////////////
///Server init
////////////////////////////////////////////
server.listen(port);

///Exportation
module.exports = app;
