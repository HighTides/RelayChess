(function() {
    var app = angular.module("relayApp", ["ngRoute", "ngStorage", "angularModalService"]);

    //config our routes
    app.config(function ($routeProvider) {
        $routeProvider.when("/", {
            templateUrl: "login.html",
            controller: "loginController"
        }).when("/register", {
            templateUrl: "register.html",
            controller: "loginController"
        }).when("/lobby", {
            templateUrl: "lobby.html",
            controller: "lobbyController"
        }).when("/play/:id/:orientation", {
            templateUrl: "play.html",
            controller: "playController"
        }).otherwise({redirectTo: "/"});
    });
})();