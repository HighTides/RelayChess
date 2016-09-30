(function() {
    var app = angular.module("relayApp");

    app.controller("lobbyController", function ($rootScope, $scope, $http, $window, $route, $routeParams, $location, $localStorage, relayChess, ModalService, relayAudio) {
        $scope.relayChess = relayChess;

        //back to login if we don't have a token
        if($localStorage.userToken == undefined || $localStorage.userToken == null)
        {
            $location.path("login");
        }

        $scope.userToken = JSON.parse($localStorage.userToken);

        //check token
        relayChess.socket.emit("login", {token: $scope.userToken});

        $scope.navigate = function(to)
        {
            $location.path(to);
        };

        $scope.logout = function()
        {
            $localStorage.userToken = null;
            $location.path("login");
        };

        $scope.answerSeek = function(seek)
        {
            if(seek == $scope.userToken.name){
                //cancel seek
                relayChess.socket.emit("cancelSeek");
                return;
            }

            relayChess.socket.emit("answerSeek", {seek: seek});
        };

        $scope.spectateGame = function(game)
        {
            //determine orientation
            var orientation = ($scope.userToken.name == game.black.name)?"b":"w";

            //spectate Game
            $location.path("play/" + game.id + "/" + orientation);
        };

        $scope.openSeekDialog = function()
        {
            relayAudio.playSound("click");

            ModalService.showModal({
                templateUrl: "seekModal.html",
                controller: "seekModalController"
            }).then(function(modal){
                modal.close.then(function(result){
                    if(result)
                    {
                        console.log("new game " + result.time);
                        relayChess.socket.emit("seek", {time: result.time, inc: result.inc});

                        //send out seek request
                        //and wait for joinGame message

                        //send seek cancel on controller exit
                    }
                });
            });
        };

        $scope.openSeekAIDialog = function()
        {
            relayAudio.playSound("click");

            ModalService.showModal({
                templateUrl: "seekAIModal.html",
                controller: "seekAIModalController"
            }).then(function(modal){
                modal.close.then(function(result){
                    if(result)
                    {
                        console.log("new ai game " + result);

                        //start AI game
                        $location.path("playAI/" + result + "/w");
                    }
                });
            });
        };

        $scope.openFriendSeekDialog = function()
        {
            ModalService.showModal({
                templateUrl: "seekModal.html",
                controller: "seekModalController"
            }).then(function(modal){
                modal.close.then(function(result){
                    if(result)
                    {
                        console.log("new game " + result.time);
                    }
                });
            });
        };
    });
})();
