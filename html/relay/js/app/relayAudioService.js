(function() {
    var app = angular.module("relayApp");

    app.factory("relayAudio", function ($rootScope, $location, $localStorage, ngAudio) {

        //load sounds
        var sounds = {
            check: ngAudio.load("sound/robot/Check.ogg"),
            move: ngAudio.load("sound/standard/Move.ogg"),
            capture: ngAudio.load("sound/standard/Capture.ogg"),
            newGame: ngAudio.load("sound/standard/GenericNotify.ogg")
        };

        function audioService(){ }

        audioService.volume = 0.5;

        audioService.playSound = function(sound){
            if(sound in sounds){
                sounds[sound].volume = audioService.volume;
                sounds[sound].play();
            }
        };

        return audioService;
    });
})();
