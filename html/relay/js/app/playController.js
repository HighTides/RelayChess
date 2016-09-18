(function() {
    window.requestAnimFrame = (function(){
        return  window.requestAnimationFrame       ||
            window.webkitRequestAnimationFrame ||
            window.mozRequestAnimationFrame    ||
            window.oRequestAnimationFrame      ||
            window.msRequestAnimationFrame     ||
            function(/* function */ callback, /* DOMElement */ element){
                window.setTimeout(callback, 1000 / 60);
            };
    })();

    var app = angular.module("relayApp");

    app.controller("playController", function ($rootScope, $scope, $http, $window, $route, $routeParams, $location, $localStorage, relayChess, ModalService) {
        $scope.relayChess = relayChess;

        //back to login if we don't have a token
        if($localStorage.userToken == undefined || $localStorage.userToken == null)
        {
            $location.path("login");
        }

        $scope.userToken = JSON.parse($localStorage.userToken);

        //check token
        relayChess.socket.emit("login", {token: $scope.userToken});

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

        var chess;
        var ground;

        relayChess.socket.emit("joinedGame", {id: gameID});

        var fen = undefined;
        chess = new Chess(fen);

        var board = angular.element("#relayBoard")[0];
        ground = Chessground(board,
        {
            fen: chess.fen(),
            orientation: orientation,
            viewOnly: false,
            animation: {
                duration: 500
            },
            movable: {
                free: false,
                events: {
                    after: onMove
                }
            },
            premovable: {
                enabled: false
            },
            drawable: {
                enabled: true
            }
        });

        var lastTimerUpdate = null;
        var timerUpdateFrameRequest = null;

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
            }
        }

        function updateActivePlayer()
        {
            if(chess.turn() == (orientation=="white"?"w":"b")){
                $scope.us.active = true;
                $scope.them.active = false;
            }
            else{
                $scope.them.active = true;
                $scope.us.active = false;
            }

            $rootScope.$apply();
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

        function switchToInGameUI(){
            angular.element("#preGame").css("display", "none");
            angular.element("#gameRunning").css("display", "inherit");
        }

        //endpoints
        var cleanSetupGame = $rootScope.$on("setupGame", function (event, response) {
            //update game information
            console.log("socket -> setupGame");

            if(orientation == "white"){
                $scope.us = response.white;
                $scope.them =  response.black;
            }else{
                $scope.us = response.black;
                $scope.them = response.white;
            }

            //set fen
            chess = new Chess(response.fen);

            if(chess.turn() == response.orientation) {
                //our turn
                //make pieces movable
                ground.set({
                    fen: chess.fen(),
                    turnColor: chessToColor(chess),
                    movable: {
                        color: chessToColor(chess),
                        dests: chessToDests(chess)
                    }
                });
            }
            else
            {
                ground.set({
                    fen: response.fen,
                    turnColor: chessToColor(chess)
                });
            }

            updateActivePlayer();

            if(chess.in_check())
            {
                ground.setCheck();
            }

            if(response.timing)
            {
                //timer is running
                gameRunning = true;
                startUpdateTimer();

                switchToInGameUI();
            }

            //update all the values
            $rootScope.$apply();
        });

        var cleanStartGame = $rootScope.$on("startGame", function (event, response) {
            console.log("socket -> startGame");

            //start the clocks
            gameRunning = true;
            startUpdateTimer();

            switchToInGameUI();
        });

        var cleanTimeUpdate = $rootScope.$on("timeUpdate", function (event, response) {
            console.log("socket -> timeUpdate");

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

            var move = response.move;
            var orig = move.from;
            var dest = move.to;
            var promotion = move.promotion;

            if(promotion)
            {
                var move = chess.move({from: orig, to: dest, promotion: promotion});

                ground.set({
                    fen: chess.fen(),
                    turnColor: chessToColor(chess),
                    movable: {
                        color: chessToColor(chess),
                        dests: chessToDests(chess)
                    }
                });

                if(chess.in_check())
                {
                    ground.setCheck();
                }

                return;
            }

            var move = chess.move({from: orig, to: dest});

            if(move == null)
            {
                var fen = chess.fen();
                debugger;
            }

            console.log(chess.fen());

            onCastle(move);

            ground.move(orig, dest);

            ground.set({
                turnColor: chessToColor(chess),
                movable: {
                    color: chessToColor(chess),
                    dests: chessToDests(chess)
                }
            });

            if(chess.in_check())
            {
                ground.setCheck();
            }

            updateActivePlayer();
        });

        var cleanGameOver = $rootScope.$on("gameOver", function (event, response) {
            if(response.result == "abort") {
                $scope.gameResult = "";
                $scope.gameResultReason = "Game Aborted";
            }
            else if(response.result == "draw"){
                $scope.gameResult = "1/2 - 1/2";
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

            if(response.result != "abort"){
                //display rating change
                var whiteChange = response.ratings.white - response.preRatings.white;
                var blackChange = response.ratings.black - response.preRatings.black;

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

            angular.element("#preGame").css("display", "none");
            angular.element("#gameRunning").css("display", "none");
            angular.element("#gameOver").css("display", "inherit");

            $rootScope.$apply();
        });

        //promotion ui
        var pendingPromotion = null;

        $("#promoteQueen").click(function(){
            onPromotionFinalize("q");
        });

        $("#promoteRook").click(function(){
            onPromotionFinalize("r");
        });

        $("#promoteBishop").click(function(){
            onPromotionFinalize("b");
        });

        $("#promoteKnight").click(function(){
            onPromotionFinalize("n");
        });

        function onPromotion(orig, dest)
        {
            pendingPromotion = {orig: orig, dest: dest};

            $("#promotePanel").css("visibility", "visible");
        };

        function onPromotionFinalize(promote)
        {
            if(pendingPromotion == null)
            {
                return;
            }

            $("#promotePanel").css("visibility", "hidden");

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