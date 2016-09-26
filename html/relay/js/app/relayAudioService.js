(function() {
    var app = angular.module("relayApp");

    app.factory("relayAudio", function ($rootScope, $location, $localStorage, ngAudio) {

        //load sounds
        var sounds = {
            capture: ngAudio.load("sound/standard/Capture.ogg"),
            challenge: ngAudio.load("sound/sfx/NewChallenge.ogg"),
            check: ngAudio.load("sound/robot/Check.ogg"),
            chime: ngAudio.load("sound/sfx/GenericNotify.ogg"),
            click: ngAudio.load("sound/sfx/Berserk.ogg"),
            defeat: ngAudio.load("sound/nes/Defeat.ogg"),
            draw: ngAudio.load("sound/nes/Draw.ogg"),
            lowtime: ngAudio.load("sound/standard/LowTime.ogg"),
            move: ngAudio.load("sound/standard/Move.ogg"),
            notify: ngAudio.load("sound/standard/GenericNotify.ogg"),
            victory: ngAudio.load("sound/nes/Victory.ogg"),
            silence: ngAudio.load("sound/Silence.ogg")
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
