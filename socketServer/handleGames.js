var io = require("./socketConnection");
var co = require("co");
var _ = require("underscore");

//app modules
var data = require("../data");
var userToken = require("../userToken");
var elo = require("../eloRating");

var utils = require("./utils");

module.exports = {
    handle: function(socket){

        function abortGame(game){
            //notify players
            game.white.socket.emit("gameOver", {result: "abort"});
            game.black.socket.emit("gameOver", {result: "abort"});

            //remove game
            delete data.activeGames[game.id];
        }

        function gameOver(game){
            //notify both players of the game results, calculate new ratings and store game results in database
            var result = null;

            if(game.chess.game_over())
            {
                if(game.chess.in_checkmate()){
                    result = {result: "checkmate", winner: game.chess.turn()=="w"?"b":"w"};
                }else if(game.chess.in_draw()){
                    if(game.chess.in_stalemate()){
                        result = {result: "draw", reason:"stalemate"};
                    }else if(game.chess.in_threefold_repetition()){
                        result = {result: "draw", reason:"repetition"};
                    }else if(game.chess.insufficient_material()){
                        result = {result: "draw", reason:"material"};
                    }else{
                        result = {result: "draw", reason:"50 moves"};
                    }
                }
            }else{
                //check if either player ran out of time
                if(game.white.time <= 0){
                    game.white.time = 0;

                    if(game.chess.has_mating_material("b")){
                        result = {result: "timeout", winner: "b"};
                    }else{
                        result = {result: "draw", reason:"timeout"};
                    }
                }else if(game.black.time <= 0){
                    game.black.time = 0;

                    if(game.chess.has_mating_material("w")){
                        result = {result: "timeout", winner: "w"};
                    }else{
                        result = {result: "draw", reason:"timeout"};
                    }
                }

                //check if player resigned
                if(game.white.resign){
                    result = {result: "resign", winner: "b"};
                }else if(game.black.resign){
                    result = {result: "resign", winner: "w"};
                }
            }
            
            if(result){
                //game ended
                console.log("game ended");

                //remove game
                clearTimeout(game.currentTimeout);
                delete data.activeGames[game.id];

                var nResult = 0;

                if(result.result == "draw"){
                    //draw
                    nResult = 0.5;
                }else{
                    //decisive
                    if(result.winner == "w"){
                        nResult = 1;
                    }else{
                        nResult = 0;
                    }
                }

                co(function*(){
                    //update player ratings
                    var playerWhite = yield data.userCollection.findOne({name: game.white.name});
                    var playerBlack = yield data.userCollection.findOne({name: game.black.name});

                    //TODO: glicko 2
                    var adjustedRatings = elo.getNewRatings(playerWhite.rating, playerBlack.rating, nResult, 32, 32);

                    //update user db 
                    yield data.userCollection.update({name:playerWhite.name}, {$set:{rating:adjustedRatings.white}});
                    yield data.userCollection.update({name:playerBlack.name}, {$set:{rating:adjustedRatings.black}});

                    result.preRatings = { white: playerWhite.rating, black: playerBlack.rating };
                    result.ratings = adjustedRatings;

                    //update server users
                    if(playerWhite.name in data.loggedInUsers)
                        data.loggedInUsers[playerWhite.name].rating = adjustedRatings.white;

                    if(playerBlack.name in data.loggedInUsers)
                        data.loggedInUsers[playerBlack.name].rating = adjustedRatings.black;

                    //send results
                    try{
                        game.white.socket.emit("gameOver", result);
                    }catch(ex){ }

                    try{
                        game.black.socket.emit("gameOver", result);
                    }catch(ex){ }

                    //store game
                    var newGame = {
                        id: game.id,
                        time: game.time,
                        increment: game.increment,

                        white: playerWhite.name,
                        black: playerBlack.name,
                        result: result,
                        
                        pgn: game.chess.pgn(),
                        finalPosition: game.chess.fen()
                    };

                    yield data.gameCollection.insertOne(newGame);         
                });           
            }
        }

        //player joined the game 
        socket.on("joinedGame", function(request){
            console.log("socket -> joinedGame");

            if(!("id" in request) || !_.isString(request.id)){
                //invalid request
                return;
            }

            var user = utils.getServerUserBySocket(socket);

            if(!user){
                //invalid user
                return;
            }

            //look for game with id and verify that user is playing in the game
            var game = data.activeGames[request.id];

            if(!game){
                //invalid id
                return;
            }

            var color = game.getColorForUsername(user.name);

            if(!color || !(data.loggedInUsers[game.white.name] && data.loggedInUsers[game.black.name])){
                //user not playing in this game
                //add user as a spectator and reference their socket
                //currently it is not possible to un-spectate
                game.spectators[user.name] = socket;

                socket.emit("setupGameSpectate", {
                    orientation: color,
                    fen: game.chess.fen(),
                    timing: game.timing,
                    white: {
                        title: whitePlayer.title,
                        displayName: whitePlayer.displayName,
                        rating: whitePlayer.rating,
                        time: updatedTime.white
                    },
                    black: {
                        title: blackPlayer.title,
                        displayName: blackPlayer.displayName,
                        rating: blackPlayer.rating,
                        time: updatedTime.black
                    }
                });
                return;
            }

            //send configuration to user (board position, color, opponent, clocks, etc.)
            var whitePlayer = data.loggedInUsers[game.white.name];
            var blackPlayer = data.loggedInUsers[game.black.name];

            console.log("socket -> setupGame");

            var updatedTime = game.getAdjustedPlayerTime();

            socket.emit("setupGame", {
                orientation: color,
                fen: game.chess.fen(),
                timing: game.timing,
                white: {
                    title: whitePlayer.title,
                    displayName: whitePlayer.displayName,
                    rating: whitePlayer.rating,
                    time: updatedTime.white
                },
                black: {
                    title: blackPlayer.title,
                    displayName: blackPlayer.displayName,
                    rating: blackPlayer.rating,
                    time: updatedTime.black
                }
            });

            //set user ready 
            game.readyUp(user.name, socket);

            if(!game.playing && game.isGameReady()){
                console.log("game started (" + request.id + ")");
                //both players have readied up
                //lets start the game
                game.playing = true;

                //start timeout for game abortion after 15s
                game.currentTimeout = setTimeout(function(){
                    //game abortion after 15s without moves
                    abortGame(game);
                }, 15000);
            }
        });

        //player made a move
        socket.on("move", function(request){
            console.log("socket -> move");
            if(!("id" in request) || !_.isString(request.id)){
                //invalid request
                return;
            }

            if(!("move" in request)){
                //invalid request
                return;
            }

            //validate move
            if(!("from" in request.move) || !_.isString(request.move.from)){
                //invalid request (missing field 'from')
                return;
            }

            if(!("to" in request.move) || !_.isString(request.move.to)){
                //invalid request (missing field 'to')
                return;
            }
            
            if(("promotion" in request.move) && !_.isString(request.move.promotion)){
                //invalid request (invalid optional field 'promotion')
                return;
            }

            var game = data.activeGames[request.id];

            if(!game){
                //invalid game id
                return;
            }

            var user = utils.getServerUserBySocket(socket);

            if(!user){
                //invalid user
                return;
            }

            var color = game.getColorForUsername(user.name);

            if(!color){
                //user not playing in this game
                return;
            }

            if(game.chess.turn() != color){
                //not this players turn
                return;
            }

            //make the mooooove
            if(game.chess.move(request.move) == null){
                //invalid move
                return;
            }
            
            //send move to opponent
            var opponent = game.getOpponent(user.name);

            opponent.socket.emit("move", request);
            utils.emitSpectatorMove(game, request);

            //check for game over
            if(game.chess.game_over()){
                clearTimeout(game.currentTimeout);
                gameOver(game);
                return;
            }

            //cancel startgame timeout after blacks first move (TODO: variation support with black as the first to move (expose chess.js ply number))
            if(!game.timing && game.chess.turn() == "w"){
                //start the timer
                game.timing = true;

                //start the clocks
                game.white.socket.emit("startGame");
                game.black.socket.emit("startGame");
            }

            if(game.timing){
                var timeout = game.chess.turn() == "w"? game.white.time : game.black.time;

                clearTimeout(game.currentTimeout);
                game.currentTimeout = setTimeout(function(){
                    //set players time to 0
                    if(game.chess.turn() == "w"){
                        game.white.time = 0;
                    }
                    else
                    {
                        game.black.time = 0;
                    }

                    //player timed out
                    gameOver(game);
                }, timeout * 60 * 1000);

                if(game.lastMoveTime != null){
                    var timeSpent = (Date.now() - game.lastMoveTime) / (1000 * 60);

                    if(game.chess.turn() == "w"){
                        //it was blacks turn
                        game.black.time -= timeSpent;
                        game.black.time += game.increment / 60;
                    }else{
                        game.white.time -= timeSpent;
                        game.white.time += game.increment / 60;
                    }

                    if(game.black.time <= 0 || game.white.time <= 0){
                        console.log("time sub zero WTF");
                        gameOver(game);
                    }
                }

                game.lastMoveTime = Date.now();

                console.log("time -> " + game.chess.turn() + " ( " + timeout + " )");

                //send time updates to both players
                var times = {white: game.white.time, black: game.black.time};
                game.white.socket.emit("timeUpdate", times);
                game.black.socket.emit("timeUpdate", times);
            }
        });

        socket.on("resignGame", function(request){
            console.log("socket -> move");
            if(!("id" in request) || !_.isString(request.id)){
                //invalid request
                return;
            }

            var game = data.activeGames[request.id];

            if(!game){
                //invalid game id
                return;
            }

            if(!game.timing){
                //cannot resign before timer starts
                return;
            }

            var user = utils.getServerUserBySocket(socket);

            if(!user){
                //invalid user
                return;
            }

            var color = game.getColorForUsername(user.name);

            if(!color){
                //user not playing in this game
                return;
            }

            if(color == "w"){
                game.white.resign = true;
            }else{
                game.black.resign = true;
            }

            //end the game
            gameOver(game);
        });

        socket.on("abortGame", function(request){
            console.log("socket -> move");
            if(!("id" in request) || !_.isString(request.id)){
                //invalid request
                return;
            }

            var game = data.activeGames[request.id];

            if(!game){
                //invalid game id
                return;
            }

            if(game.timing){
                //cannot abort after timer starts
                return;
            }

            var user = utils.getServerUserBySocket(socket);

            if(!user){
                //invalid user
                return;
            }

            var color = game.getColorForUsername(user.name);

            if(!color){
                //user not playing in this game
                return;
            }

            abortGame(game);
        });
    }
}
