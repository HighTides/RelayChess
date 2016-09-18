var io = require("./socketConnection");
var co = require("co");
var _ = require("underscore");

//app modules
var data = require("../data");
var userToken = require("../userToken");

var utils = require("./utils");

var game = require("./game");

module.exports = {
    handle: function(socket){

        //player submitted new seek
        socket.on("seek", function(request){
            console.log("socket -> seek");

            //validate input
            if(!("time" in request) || !("inc" in request) || 
            !_.isNumber(request.time) || !_.isNumber(request.inc) || 
            request.time < 0 || request.inc < 0 || 
            (request.time == 0 && request.inc == 0)){
                //invalid request
                return;
            }

            var user = utils.getServerUserBySocket(socket);
            
            if(!user){
                //invalid user
                return;    
            }
            data.gameSeeks[user.name] = {
                user: user,
                time: request.time, 
                increment: request.inc,
                minRating: 0,
                maxRating: 9999
            };

            //push updated seeks to all players
            utils.emitSeeksUpdate(io.sockets);
        });

        //player canceled seek
        socket.on("cancelSeek", function(){
            console.log("socket -> cancelSeek");
            
            var user = utils.getServerUserBySocket(socket);
            
            if(!user){
                //invalid user
                return;    
            }

            if(user.name in data.gameSeeks){
                delete data.gameSeeks[user.name];

                //push updated seeks to all players
                utils.emitSeeksUpdate(io.sockets);
            }
        });

        //player answered seek
        socket.on("answerSeek", function(request){
            console.log("socket -> answerSeek");

            if(!("seek" in request) || !_.isString(request.seek)){
                //invalid request
                return;
            }
            
            var user = utils.getServerUserBySocket(socket);
            
            if(!user){
                //invalid user
                return;    
            }

            if(user.name == request.seek){
                //can't join your own seek
                return;
            }

            if(request.seek in data.gameSeeks){
                //check if other player is still online
                if(!(request.seek in data.loggedInUsers))
                {
                    //player went offline cancel seek
                    delete data.gameSeeks[request.seek];

                    return;
                }
                
                //create new game
                //TODO: random colors
                var newGame = new game(
                    request.seek, 
                    user.name, 
                    data.gameSeeks[request.seek].time, 
                    data.gameSeeks[request.seek].increment);
                
                var id = utils.generateGameID();

                data.activeGames[id] = newGame;
                newGame.id = id;

                //invite players to game
                socket.emit("joinGame", {id: id, orientation: "b"});
                data.loggedInUsers[request.seek].sockets[0].emit("joinGame", {id: id, orientation: "w"});

                //delete the requested seek
                delete data.gameSeeks[request.seek];

                //remove potential seek of answering players
                if(user.name in data.gameSeeks){
                    delete data.gameSeeks[user.name];
                }

                //push updated seeks to all players
                utils.emitSeeksUpdate(io.sockets);
            }
            
        });
    }
};