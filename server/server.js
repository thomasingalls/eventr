
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
var port = 8000;

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
}).then(function(database) {
  db = database;
});

//////////////////////////////////////////////
///Express Controllers
//////////////////////////////////////////////

app.use(express.static(__dirname + '/../client'));

//////////////////////////////////////////////
///Socket Controllers
//////////////////////////////////////////////

//Controllers -> might need to move someplace els

io.on('connection', function (socket) {

  socket.on('testing',function(){
    console.log('test works');
  });
  //Signup Listener
  socket.on('signup', function (signupData) {
    var newUser = {
      username: signupData.username,
      email: signupData.email,
      password: signupData.password,
      created_at: util.mysqlDatetime(),
    }
    db.query('INSERT INTO users SET ?', newUser)
      .then(function (data) {
        // Let's encode with the email for now. Encode with the user object if have time.
        var token = jwt.encode(newUser.email, 'secret');

        loggedIn[signupData.email] = socket.id;
        socket.emit('signupSuccess', token);
      })
      .catch(function (error) {
        console.error(error);
        if (error.errno === 1062) {
          socket.emit('signupUserExists');
        }
        //ADD OTHER ERROR SCENARIOS HERE!
      });
  });


  //Login Listener
  socket.on('login', function (loginData) {
    //save into socket loggedIn user array
    db.query('SELECT * FROM users WHERE email = ?', loginData.email)
      .then(function (data) {
        if (data[0].password === loginData.password) {
          // Let's encode with the email for now. Encode with the entire user object if have time.
          var token = jwt.encode(loginData.email, 'secret');
          loggedIn[loginData.email] = socket.id;

          var loginPackage = {
            token: token,
            username: data[0].username
          };

          socket.emit('loginSuccess', loginPackage);
        } else {
          socket.emit('loginWrongPassword');
        }
      })
      .catch(function (error) {
        socket.emit('loginUserDoesNotExist');
      });
  });

  //Logout Listener
  socket.on('logout', function () {
    // Delete token from client
    socket.emit('logoutSuccess');

    // Close socket connection
    for (var key in loggedIn) {
      if (loggedIn[key] === socket.id) {
        delete loggedIn[key];
      }
    }
  });

  //Check Auth Listener -- DOESNT WORK RIGHT NOW
  socket.on('checkAuth', function (token) {
    if (!token) {
      socket.emit('tokenFailed');
    } else {
      var userEmail = jwt.decode(token, 'secret');

      db.query('SELECT email FROM users WHERE email = ?', userEmail)
        .then(function (data) {
          if (data[0].email === userEmail) {
            //token confirmed so send back response to client
            socket.emit('tokenConfirmed');
          }
        })
        .catch(function (error) {
          console.error(error);
          socket.emit('tokenFailed');
        });
    }
  });


  // socket.on('retrieveNotifications', function() {
  //   var email = util.findEmail(socket.id, loggedIn);
  //   var id = util.fineUser(db, email);
  //   db.query('SELECT * FROM events where id = ');
  // });

  ////createEvent View
  socket.on('addEvent', function (data) {
    //Store data into database;
    var event = {
      created_at: util.mysqlDatetime(),
      updated_at: util.mysqlDatetime(),
      event_name: data.name,
      response_deadline: data.deadline,
      total_cost: data.cost,
      event_host: '',
    };
    var friends = data.friends;

    var eventid = '';

    var userEmail = util.findEmail(socket.id, loggedIn);

    db.query('SELECT id FROM users WHERE email = ?', userEmail)
      .then(function (data) {
        event['event_host'] = data[0].id;
      })
      .then(function () { //inserts object
        return db.query('INSERT INTO events SET ?', event);
      })
      .then(function (data) { //sets eventID in an accessible scope
        eventid = data.insertId;
        //Add All the connections for all the users
        //Host connection
        util.createEvents_Users(db, event.event_host, eventid);
        //Everyone in the friends list
        _.each(friends, function (email) {
          util.findUser(db, email)
            .then(function (friendID) {
              util.createEvents_Users(db, friendID[0].id, eventid);
            });
        });
      })
      .then(function () {
        util.createQuestion(db, util, 'Activities', eventid, event.event_host, data.activities, friends);
        util.createQuestion(db, util, 'Locations', eventid, event.event_host, data.locations, friends);
      })
      .then(function(){
        db.query('SELECT * FROM events_users WHERE event_id = ?', eventid)
          .then(function(data){
            return data;
          })
          .then(function(data){
            util.eventBroadcast(io, db, eventid, loggedIn, 'this is working');
            socket.emit('eventID', eventid);
          });
      });
    });

    socket.on('pollResultsData', function(eventID){
      var package = {
        event: {},
        activities: [],
        locations: [],
        participants: [],
      };
      db.query('SELECT * FROM events WHERE id = ?', eventID)
        .then(function(data){
          package['event'] = data[0];
          return db.query('SELECT id FROM questions WHERE (event_id = ?) AND (text = "Activities")', eventID);
        }).then(function(choiceID){
          return db.query('SELECT * FROM choices WHERE question_id = ?', choiceID[0].id);
        }).then(function(activitiesData){
          package.activities = activitiesData;
          return db.query('SELECT id FROM questions WHERE (event_id = ?) AND (text = "Locations")', eventID);
        }).then(function(choiceID){
          return db.query('SELECT * FROM choices WHERE question_id = ?', choiceID[0].id);
        }).then(function(locationsData){
          package.locations = locationsData;
          return db.query('SELECT username from events_users left join users on users.id = events_users.user_id where event_id = ?', eventID);
        }).then(function(arrayOfUserId){
          package.participants = arrayOfUserId;
          socket.emit('pollResultsPackage', package);
        });
    });

    socket.on('votes', function(votes){
      //Find Question ID FIrst
      db.query('SELECT id from questions WHERE (text = Activities) AND (event_id = ?)', votes.id)
        .then(function(questionID){
          return db.query('UPDATE choices SET votesFor = votesFor + 1 WHERE (text =' + votes.event +') AND (id = ?)', questionID);
        })
        .then(function(){
          return db.query('SELECT id FROM questions WHERE (text = Locations) AND (event_id = ?)', voted.id);
        })
        .then(function(questionID) {
          return db.query('UPDATE choices SET votesFor = votesFor + 1 WHERE (text =' + votes.date +') AND (id=?)', questionID);
        });
    });

});




//util.eventBroadcast(io, db, event, loggedIn, data);

/////////////////////////////////////////////
///Server init
////////////////////////////////////////////
server.listen(port);

///Exportation
module.exports = app;
