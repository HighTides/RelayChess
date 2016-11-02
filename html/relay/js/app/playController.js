(function() {
    window.requestAnimFrame = (function(){
        return  window.requestAnimationFrame   ||
            window.webkitRequestAnimationFrame ||
            window.mozRequestAnimationFrame    ||
            window.oRequestAnimationFrame      ||
            window.msRequestAnimationFrame     ||
            function(/* function */ callback, /* DOMElement */ element){
        window.setTimeout(callback, 1000 / 60);
    };
    })();

    var app = angular.module("relayApp");

    app.controller("playController", function ($rootScope, $scope, $http, $window, $route, $routeParams, $location, $localStorage, ModalService, relayChess, relayAudio) {
        $scope.relayChess = relayChess;
        relayAudio.ensureLobbyIsNotPlaying();

        //login as anonymous or with user token
        relayChess.login();

        var spectating = false;

        $scope.them = {
            title:null,
            displayName:null,
            rating:null,
            time: null,
            active: false,
            ratingChange:null
        };

        $scope.us = {
            title:null,
            displayName:null,
            rating:null,
            time: null,
            active: false,
            ratingChange:null
        };

        var gameRunning = false;
        var gameID = $routeParams.id;
        var orientation = $routeParams.orientation=="w"?"white":"black";
        var playOrientation;

        var chess;
        var ground;

        //join the game (as player or spectator)
        relayChess.socket.emit("joinedGame", {id: gameID});

        var fen = undefined;
        chess = new Chess(fen);

        var board = angular.element("#relayBoard")[0];
        ground = Chessground(board,
        {
            orientation: orientation,
            turnColor: chessToColor(chess),
            viewOnly: false,
            animation: {
                duration: 250
            },
            movable: {
                free: false,
                color: "black",
                events: {
                    after: onMove
                }
            },
            premovable: {
                relay: true
            },
            drawable: {
                enabled: true
            },
            selectable: {
                enabled: false
            }
        });

        var lastTimerUpdate = null;
        var timerUpdateFrameRequest = null;
        var lowtime = false;

        function startUpdateTimer()
        {
            if(timerUpdateFrameRequest != null){
                window.cancelAnimationFrame(timerUpdateFrameRequest);
            }

            updateTimer();
        }

        function updateTimer()
        {
            if(lastTimerUpdate){
                var diff = (Date.now() - lastTimerUpdate) / (1000 * 60);

                //subtract diff from current running timer
                if(chess.turn() == "w"){
                    if(orientation == "white"){
                        $scope.us.time -= diff;
                    }
                    else{
                        $scope.them.time -= diff;
                    }
                }else{
                    if(orientation == "white"){
                        $scope.them.time -= diff;
                    }
                    else{
                        $scope.us.time -= diff;
                    }
                }

                $rootScope.$apply();
            }

            lastTimerUpdate = Date.now();

            if(gameRunning) {
                timerUpdateFrameRequest = window.requestAnimFrame(updateTimer);
                if(!spectating) {
                    if($scope.us.time * 60 >= 20) {
                        lowtime = false;
                    } else if($scope.us.time * 60 <= 11) {
                        if(!lowtime) {
                            relayAudio.playSound("lowtime");
                        }
                        lowtime = true;
                    }
                }
            }
        }

        function updateActivePlayer()
        {
            if(chess.turn() == (orientation=="white"?"w":"b")){
                $scope.us.active = true;
                $scope.them.active = false;
            }else{
                $scope.them.active = true;
                $scope.us.active = false;
            }

            $rootScope.$apply();
        }

        function playSound(move){
            //sounds
            if(move.flags.indexOf("c") != -1 || move.flags.indexOf("e") != -1)
            {
                //capture
                relayAudio.playSound("capture");
            }
            else if(move.flags.indexOf("k") != -1 || move.flags.indexOf("q") != -1)
            {
                //castle
                relayAudio.playSound("castle");
            }
            else
            {
                //move
                relayAudio.playSound("move");
            }

            if (chess.in_check())
            {
                //check
                relayAudio.playSound("check");
            }
        }

        $scope.$on("$destroy", function() {
            cleanupRootScopeHandlers();

            if(timerUpdateFrameRequest != null){
                window.cancelAnimationFrame(timerUpdateFrameRequest);
            }
        });

        function cleanupRootScopeHandlers(){
            cleanSetupGame();
            cleanStartGame();
            cleanTimeUpdate();
            cleanMove();
            cleanGameOver();
        }

        //UI bindings
        $scope.gameResult = "";
        $scope.gameResultReason = "";

        $scope.backToLobby = function(){
            $location.path("lobby");
        };

        $scope.abortGame = function(){
            relayChess.socket.emit("abortGame", {id: gameID});
        };

        $scope.resignGame = function(){
            relayChess.socket.emit("resignGame", {id: gameID});
        };

        $scope.rematch = function(){
            //TODO
        };

        function showUI(state){
            angular.element("#preGame").css("display", "none");
            angular.element("#gameRunning").css("display", "none");
            angular.element("#gameOver").css("display", "none");

            if(spectating){
                //spectator ui
                if(state == "postgame"){
                    angular.element("#gameOver").css("display", "inherit");
                }
            }
            else
            {
                //player ui
                if(state == "pregame"){
                    angular.element("#preGame").css("display", "inherit");
                }
                else if(state == "ingame"){
                    angular.element("#gameRunning").css("display", "inherit");
                }
                else if(state == "postgame"){
                    angular.element("#gameOver").css("display", "inherit");
                }
            }
        }

        //endpoints
        var cleanSetupGame = $rootScope.$on("setupGame", function (event, response) {
            //update game information
            console.log("socket -> setupGame");

            //sanity check
            if(response.id != gameID)
                return;

            if(orientation == "white"){
                $scope.us = response.white;
                $scope.them =  response.black;
            }else{
                $scope.us = response.black;
                $scope.them = response.white;
            }

            //set history and position
            chess = new Chess();
            for (move in response.history) {
                chess.move(response.history[move]);
            }
            var lastMove = null;
            var history = chess.history({verbose: true});
            for (move in history) {
                lastMove = history[move];
            }

            playOrientation = response.orientation;

            if(chess.turn() == response.orientation) {
                //our turn
                //make pieces movable
                ground.set({
                    fen: chess.fen(),
                    lastMove: lastMove == null ? null : [lastMove.from, lastMove.to],
                    turnColor: chessToColor(chess),
                    movable: {
                        color: chessToColor(chess),
                        dests: chessToDests(chess)
                    }
                });
            }
            else
            {
                //enable premoves
                ground.set({
                    fen: response.fen,
                    lastMove: lastMove == null ? null : [lastMove.from, lastMove.to],
                    turnColor: chessToColor(chess)
                });
            }

            if(chess.in_check())
            {
                ground.setCheck();
            }

            updateActivePlayer();


            if("spectate" in response && response.spectate){
                //we are only spectating
                console.log("spectating");
                spectating = true;

                ground.set({
                    viewOnly: true,
                    movable: {
                        color: "none"
                    },
                    premovable: {
                        enabled: false
                    }
                });
            }

            if(response.timing)
            {
                //timer is running
                gameRunning = true;
                startUpdateTimer();

                console.log("timing")
                showUI("ingame");
                relayAudio.playSound("move");
            }
            else
            {
                //timer not runnning yet
                showUI("pregame");
                relayAudio.playSound("newgame");
            }

            //update all the values
            $rootScope.$apply();
        });


        var cleanStartGame = $rootScope.$on("startGame", function (event, response) {
            console.log("socket -> startGame");

            //sanity check
            if(response.id != gameID)
                return;

            //start the clocks
            gameRunning = true;
            startUpdateTimer();

            showUI("ingame");
        });

        var cleanTimeUpdate = $rootScope.$on("timeUpdate", function (event, response) {
            console.log("socket -> timeUpdate");

            //sanity check
            if(response.id != gameID)
                return;

            if(orientation == "white") {
                $scope.us.time = response.white;
                $scope.them.time = response.black;
            }
            else
            {
                $scope.us.time = response.black;
                $scope.them.time = response.white;
            }

            updateActivePlayer();
            startUpdateTimer();
        });

        var cleanMove = $rootScope.$on("move", function (event, response) {
            console.log("socket -> move");

            //sanity check
            if(response.id != gameID)
                return;

            chess.load(response.fen);

            if (playOrientation == chess.turn() && !spectating) {
                //our turn -> movable pieces

                ground.set({
                    fen: response.fen,
                    lastMove: [response.move.from, response.move.to],
                    turnColor: chessToColor(chess),
                    movable: {
                        color: chessToColor(chess),
                        dests: chessToDests(chess)
                    }
                });
            }
            else
            {
                //opponents turn or spectating
                ground.set({
                    fen: response.fen,
                    lastMove: [response.move.from, response.move.to]
                });
            }

            if(chess.in_check())
            {
                ground.setCheck();
            }

            updateActivePlayer();

            //play premove if set
            ground.playPremove();

            playSound(response.move);
        });

        var cleanGameOver = $rootScope.$on("gameOver", function (event, response) {
            //sanity check
            if(response.id != gameID)
                return;

            if(response.result == "abort") {
                $scope.gameResult = "";
                $scope.gameResultReason = "Game Aborted";
            }
            else if(response.result == "draw"){
                $scope.gameResult = "½ - ½";
                $scope.gameResultReason = response.reason;
            }
            else if(response.result == "resign"){
                if(response.winner == "w"){
                    $scope.gameResult = "1 - 0";
                    $scope.gameResultReason = "Black Resigned";
                }else{
                    $scope.gameResult = "0 - 1";
                    $scope.gameResultReason = "White Resigned";
                }
            }
            else if(response.result == "checkmate") {
                if(response.winner == "w"){
                    $scope.gameResult = "1 - 0";
                    $scope.gameResultReason = "Checkmate, White is Victorious";
                }else{
                    $scope.gameResult = "0 - 1";
                    $scope.gameResultReason = "Checkmate, Black is Victorious";
                }
            }
            else if(response.result == "timeout"){
                if(response.winner == "w"){
                    $scope.gameResult = "1 - 0";
                    $scope.gameResultReason = "Timeout, White is Victorious";
                }else{
                    $scope.gameResult = "0 - 1";
                    $scope.gameResultReason = "Timeout, Black is Victorious";
                }
            }

            if(response.result != "abort" && 'ratings' in response){
                //display rating change
                var whiteChange = Math.round(response.ratings.white.r - response.preRatings.white.r);
                var blackChange = Math.round(response.ratings.black.r - response.preRatings.black.r);

                if(whiteChange>=0) whiteChange= "+" + whiteChange;
                if(blackChange>=0) blackChange= "+" + blackChange;

                if(orientation == "white"){
                    $scope.them.ratingChange = blackChange;
                    $scope.us.ratingChange = whiteChange;
                }else{
                    $scope.us.ratingChange = blackChange;
                    $scope.them.ratingChange = whiteChange;
                }
            }

            gameRunning = false;
            ground.stop();
            if(!spectating && response.result != "abort"){
                if((response.winner == "w") == (playOrientation == "white")){
                    relayAudio.playSound("victory");
                } else if((response.winner == "b") == (playOrientation == "white")){
                    relayAudio.playSound("defeat");
                } else {
                    relayAudio.playSound("draw");
                }
            }

            showUI("postgame");

            $rootScope.$apply();
        });

        //promotion ui
        var pendingPromotion = null;

        $(".promoteQueen").click(function(){
            onPromotionFinalize("q");
        });

        $(".promoteRook").click(function(){
            onPromotionFinalize("r");
        });

        $(".promoteBishop").click(function(){
            onPromotionFinalize("b");
        });

        $(".promoteKnight").click(function(){
            onPromotionFinalize("n");
        });

        function onPromotion(orig, dest)
        {
            pendingPromotion = {orig: orig, dest: dest};

            $(".promotePanel").css("visibility", "visible");
        };

        function onPromotionFinalize(promote)
        {
            if(pendingPromotion == null)
            {
                return;
            }

            $(".promotePanel").css("visibility", "hidden");

            var move = chess.move({from: pendingPromotion.orig, to: pendingPromotion.dest, promotion: promote});

            console.log("onPromotionFinalize");

            console.log(chess.fen());

            ground.set({
                fen: chess.fen(),
                turnColor: chessToColor(chess)
            });

            if(chess.in_check())
            {
                ground.setCheck();
            }

            //send move to server
            relayChess.socket.emit("move", {id: gameID, move: {from: pendingPromotion.orig, to: pendingPromotion.dest, promotion: promote}});
            pendingPromotion = null;
        }

        function onCastle(move) {
            //handle castling
            if (move.flags == "k") {
                //kingside

                if (chess.turn() == "w") {
                    //black
                    ground.setPieces({
                        e8: null,
                        h8: null,
                        g8: {color: "black", role: "king"},
                        f8: {color: "black", role: "rook"}
                    });
                }
                else {
                    //white
                    ground.setPieces({
                        e1: null,
                        h1: null,
                        g1: {color: "white", role: "king"},
                        f1: {color: "white", role: "rook"}
                    });
                }
            }
            else if (move.flags == "q") {
                //queenside

                if (chess.turn() == "w") {
                    //black
                    ground.setPieces({
                        e8: null,
                        a8: null,
                        c8: {color: "black", role: "king"},
                        d8: {color: "black", role: "rook"}
                    });
                }
                else {
                    //white
                    ground.setPieces({
                        e1: null,
                        a1: null,
                        c1: {color: "white", role: "king"},
                        d1: {color: "white", role: "rook"}
                    });
                }
            }
        }

        function onMove(orig, dest) {
            console.log(orig + " " + dest);

            //handle promotion
            var piece = chess.get(orig);

            var rank = chess.rank(orig);
            if(piece.type == "p" &&
                ((chess.turn() == "w" && rank == 1) || (chess.turn() == "b" && rank == 6)))
            {
                onPromotion(orig, dest);

                return false;
            }

            var move = chess.move({from: orig, to: dest});

            if(move == null)
            {
                debugger;
            }

            console.log(chess.fen());

            onCastle(move);

            ground.set({
                turnColor: chessToColor(chess)
            });

            if(chess.in_check())
            {
                ground.setCheck();
            }

            //send move to server
            relayChess.socket.emit("move", {id: gameID, move: {from: orig, to:dest}});

            updateActivePlayer();
        };

        function chessToDests(chess) {
            var dests = {};
            chess.SQUARES.forEach(function(s) {
                var ms = chess.moves({square: s, verbose: true});
                if (ms.length) dests[s] = ms.map(function(m) { return m.to; });
            });
            return dests;
        }

        function chessToColor(chess) {
            return (chess.turn() == "w") ? "white" : "black";
        }
    });
})();
