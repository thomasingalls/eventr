angular.module('app', [
  'ngRoute',
  'app.login',
  'app.signup',
  'app.start',
  'app.createEvent',
  'app.pollResults',
  'app.preferenceVote',
  'app.finalAccept',
  'app.confirmedLobby',
  'app.logout',
  'app.factories'
  ])
.config(function($routeProvider, $httpProvider) {
  $routeProvider
    .when('/', {
      templateUrl: 'app/templates/login.html',
      controller: 'LoginController'
    })
    .when('/start', {
      templateUrl: 'app/templates/start.html',
      controller: 'StartController'
    })
    .when('/createevent', {
      templateUrl: 'app/templates/createevent.html',
      controller: 'CreateEventController'
    })
    .when('/pollresults', {
      templateUrl: 'app/templates/pollresults.html',
      controller: 'PollResultsController'
    })
    .when('/preferencevote', {
      templateUrl: 'app/templates/preferencevote.html',
      controller: 'PreferenceVoteController'
    })
    .when('/finalaccept', {
      templateUrl: 'app/templates/finalaccept.html',
      controller: 'FinalAcceptController'
    })
    .when('/confirmedlobby', {
      templateUrl: 'app/templates/confirmedlobby.html',
      controller: 'ConfirmedLobbyController'
    })
    .when('/login', {
      templateUrl: 'app/templates/login.html',
      controller: 'LoginController'
    })
    .when('/logout', {
      templateUrl: 'app/templates/logout.html',
      controller: 'LogoutController'
    })
    .when('/signup', {
      templateUrl: 'app/templates/signup.html',
      controller: 'SignupController'
    })
    .otherwise({
      redirectTo: '/signup'
    });
});

// Insert Authentication here: //////////////////////






