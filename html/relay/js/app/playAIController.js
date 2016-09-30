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

    app.controller("playAIController", function ($rootScope, $scope, $http, $window, $route, $routeParams, $location, $localStorage, ModalService, relayAudio) {

        var level = $routeParams.level;
        var playOrientation = $routeParams.orientation=="w"?"white":"black";

        var fen = undefined;

        var AI = new relayChessAI();
        var chess = new Chess(fen);

        var board = angular.element("#relayAIBoard")[0];
        var ground = Chessground(board,
        {
            orientation: playOrientation,
            turnColor: chessToColor(chess),
            viewOnly: false,
            animation: {
                duration: 250
            },
            movable: {
                free: false,
                color: playOrientation,
                dests: chessToDests(chess),
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

        //UI bindings
        $scope.backToLobby = function(){
            $location.path("lobby");
        };

        function onAIMove(move){
            console.log("AI -> move");

            move = chess.move(move);

            //our turn -> movable pieces
            ground.set({
                fen: chess.fen(),
                lastMove: [move.from, move.to],
                turnColor: chessToColor(chess),
                movable: {
                    color: chessToColor(chess),
                    dests: chessToDests(chess)
                }
            });

            var check;
            if(check = chess.in_check())
            {
                ground.setCheck();
            }

            //play premove if set
            ground.playPremove();

            //sounds
            if(move.flags.indexOf("c") != -1 || move.flags.indexOf("e") != -1)
            {
                //capture
                relayAudio.playSound("capture");
            }
            else
            {
                //move
                relayAudio.playSound("move");
            }

            if (check)
            {
                //check
                relayAudio.playSound("check");
            }
        }

        function SearchAIMove()
        {
            //search next AI move (web worker?)
            console.log("search AI move");

            var AIMove = AI.searchNextMove(chess, level);
            onAIMove(AIMove);
        }

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
        }

        function onPromotionFinalize(promote)
        {
            if(pendingPromotion == null)
            {
                return;
            }

            $(".promotePanel").css("visibility", "hidden");

            var move = chess.move({from: pendingPromotion.orig, to: pendingPromotion.dest, promotion: promote});

            ground.set({
                fen: chess.fen(),
                turnColor: chessToColor(chess)
            });

            if(chess.in_check())
            {
                ground.setCheck();
            }

            SearchAIMove();

            pendingPromotion = null;
        }

        function onMove(orig, dest) {
            console.log(orig + " " + dest);

            //handle promotion
            var piece = chess.get(orig);

            var rank = chess.rank(orig);
            if(piece.type == "p" &&
                ((chess.turn() == "w" && rank == 1) ||
                (chess.turn() == "b" && rank == 6)))
            {
                onPromotion(orig, dest);

                return false;
            }

            var move = chess.move({from: orig, to: dest});

            ground.set({
                fen: chess.fen(),
                turnColor: chessToColor(chess)
            });

            if(chess.in_check())
            {
                ground.setCheck();
            }

            SearchAIMove();
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
