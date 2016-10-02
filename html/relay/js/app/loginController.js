(function() {
    var server = "http://188.166.194.141:9090";
    //server = "http://127.0.0.1:9090";

    var app = angular.module("relayApp");

    app.controller("loginController", function ($scope, $http, $window, $route, $routeParams, $location, $localStorage) {
        //skip to lobby
        if($localStorage.userToken != undefined)
        {
            $location.path("lobby");
            return;
        }

        $scope.showLogin = function()
        {
            $location.path("login");
        };

        $scope.showRegister = function()
        {
            $location.path("register");
        };

        $scope.message = "";
        $scope.requestActive = false;

        function checkUserPasswordInput(user)
        {
            if(typeof user === 'undefined')
                return false;

            //user has name with at least 3 characters
            if(!("name" in user) || user.name.length < 3) {
                $scope.message = "Username too short";
                return false;
            }

            //maximum length of username 20 characters
            if(user.name.length > 20) {
                $scope.message = "Username too long";
                return false;
            }

            //no special characters in username
            if(!(/^[0-9a-z]{3,20}$/i).test(user.name))
            {
                $scope.message = "Username must be alphanumeric";
                return false;
            }

            //user has password with at least 3 characters
            if(!("password" in user) || user.password.length < 3) {
                $scope.message = "Password too short";
                return false;
            }

            //maximum password length 20 characters
            if(user.password.length > 20) {
                $scope.message = "Password too long";
                return false;
            }

            return true;
        }

        $scope.tryLogin = function(user) {
            //sanity
            if(!checkUserPasswordInput(user))
            {
                return;
            }

            $scope.requestActive = true;

            $http(
                {
                    method: "GET",
                    url: server + "/login",
                    params: {username: user.name, password: user.password}
                }).success(function (response) {

                console.log(response);

                if(response.result == false)
                {
                    $scope.requestActive = false;
                    $scope.message = response.reason;
                }
                else
                {
                    console.log("login success");
                    $scope.requestActive = false;

                    //store token
                    $localStorage.userToken = response.token;

                    $location.path("lobby");
                }
            }).error(function(error, status){
                $scope.requestActive = false;

                $scope.message = "server not reachable";
            });
        };

        $scope.trySignup = function(user) {
            //sanity
            if(!checkUserPasswordInput(user))
            {
                return;
            }

            $scope.requestActive = true;

            $http({
                    method: "GET",
                    url: server + "/register",
                    params: {username: user.name, password: user.password}
                }).success(function (response) {

                console.log(response);

                if(response.result == false)
                {
                    $scope.requestActive = false;
                    $scope.message = response.reason;
                }
                else
                {
                    console.log("register success");
                    $scope.requestActive = false;

                    //store token
                    $localStorage.userToken = response.token;

                    $location.path("lobby");
                }
            }).error(function(error, status){
                $scope.requestActive = false;

                $scope.message = "server not reachable";
            });
        };
    });
})();
