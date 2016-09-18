(function() {
    var app = angular.module("relayApp");

    app.controller("seekModalController", function ($scope, close) {
        $scope.setTimeControl = function(time, inc)
        {
            close({time: time, inc: inc});
        };

        $scope.close = close;
    });
})();