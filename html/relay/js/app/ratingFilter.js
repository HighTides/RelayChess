(function(){
    var app = angular.module("relayApp");

    app.filter("asGlicko2", function(){
        return function(input){
            return Math.round(input.r) + " ± " + Math.round(input.rd*2);
        };
    });

})();