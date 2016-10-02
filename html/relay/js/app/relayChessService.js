(function() {
    var socketServer = "http://188.166.194.141:3000/";
    //socketServer = "127.0.0.1:3000";

    var app = angular.module("relayApp");

    app.factory("relayChess", function ($rootScope, $location, $localStorage) {
        var data = {
            socket: null,
            playerInfo: null,
            users: [],
            seeks: [],
            activeGames: []
        };

        var socket = io.connect(socketServer);

        data.socket = socket;

        data.login = function(){
            //login as anonymous if we dont have a token
            if($localStorage.userToken == undefined || $localStorage.userToken == null)
            {
                $rootScope.$apply(function () {
                    $location.path("login");
                });
            }

            $scope.userToken = JSON.parse($localStorage.userToken);

            //check token
            relayChess.socket.emit("login", {token: $scope.userToken});
        };

        socket.on("logout", function (response) {
            console.log("socket -> logout");

            //server doesn't like our token
            $localStorage.userToken = undefined;

            $rootScope.$apply(function () {
                //back to login
                $location.path("login");
            });
        });

        socket.on("userUpdate", function (response) {
            //store online users
            console.log("socket -> userUpdate");

            $rootScope.$apply(function () {
                data.users = response.users;
            });
        });

        socket.on("seekUpdate", function (response) {
            //store seeks
            console.log("socket -> seekUpdate");

            $rootScope.$apply(function () {
                data.seeks = response.seeks;
            });
        });

        socket.on("activeGameUpdate", function (response) {
            //store active games
            console.log("socket -> activeGameUpdate");

            $rootScope.$apply(function () {
                data.activeGames = response.activeGames;
            });
        });

        //chessgame endpoints
        socket.on("joinGame", function (response) {
            //move player to game after seek has been accepted etc.
            $rootScope.$apply(function () {
                $location.path("play/" + response.id + "/" + response.orientation);
            });
        });

        socket.on("setupGame", function (response) {
            $rootScope.$emit("setupGame", response);
        });

        socket.on("startGame", function (response) {
            $rootScope.$emit("startGame", response);
        });

        socket.on("move", function (response) {
            $rootScope.$emit("move", response);
        });

        socket.on("gameOver", function (response) {
            $rootScope.$emit("gameOver", response);
        });

        socket.on("timeUpdate", function (response) {
            $rootScope.$emit("timeUpdate", response);
        });

        return data;
    });
})();
