var io = require("./socketConnection");
var co = require("co");
var _ = require("underscore");

//app modules
var data = require("../data");
var userToken = require("../userToken");

function utils(){ }

utils.getDatabaseUserByName = function(name)
{
    if(name.startsWith("anonymous")){
        //return pseudo user "anonymous"
        return {
            name: name,
            title: "",
            displayName: "Anonymous",
            rating: "?"
        };
    }

    var user = data.userCollection.findOne({name: name}, {name:1, displayName:1, title:1, rating:1});

    return user;
};

utils.getServerUserBySocket = function(socket)
{
    for(var username in data.loggedInUsers)
    {
        var user = data.loggedInUsers[username];

        if(user.sockets.indexOf(socket) != -1)
        {
            return user;
        }
    }

    return null;
};

utils.generateGameID = function()
{
    function generateUUID() {
        var d = new Date().getTime();
        var uuid = 'xxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = (d + Math.random()*16)%16 | 0;
            d = Math.floor(d/16);
            return (c=='x' ? r : (r&0x3|0x8)).toString(16);
        });
        return uuid;
    };

    var id;

    //regenerate until we have a unique id
    while((id = generateUUID()) in data.activeGames){}

    return id;
};

utils.generateAnonID = function()
{
    function generateUUID() {
        var d = new Date().getTime();
        var uuid = 'xxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = (d + Math.random()*16)%16 | 0;
            d = Math.floor(d/16);
            return (c=='x' ? r : (r&0x3|0x8)).toString(16);
        });
        return uuid;
    };

    var id;

    //regenerate until we have a unique id
    while("anonymous-" + (id = generateUUID()) in data.loggedInUsers){}

    return "anonymous-" + id;
};

utils.emitUserUpdate = function(socket)
{
    //send online users and current seeks
    var publicUsers = [];

    //remove private fields
    for(var username in data.loggedInUsers){
        var user = data.loggedInUsers[username];

        publicUsers.push({
            name: user.name,
            title: user.title,
            displayName: user.displayName,
            rating: user.rating
        });
    }

    socket.emit("userUpdate", {users: publicUsers});
};

utils.emitSeeksUpdate = function(socket)
{
    var publicSeeks = [];

    for(seek in data.gameSeeks){
        var seek_ = data.gameSeeks[seek];

        publicSeeks.push({
            name: seek_.user.name,
            title: seek_.user.title,
            displayName: seek_.user.displayName,
            rating: seek_.user.rating,
            time: seek_.time,
            increment: seek_.increment,
            rated: seek_.rated
        });
    }

    socket.emit("seekUpdate", {seeks: publicSeeks});
};

utils.emitActiveGames = function(socket)
{
    co(function*(){
        var publicGames = [];

        for(game in data.activeGames){
            var game_ = data.activeGames[game];

            //get players from db
            var whitePlayer = yield utils.getDatabaseUserByName(game_.white.name);
            var blackPlayer = yield utils.getDatabaseUserByName(game_.black.name);

            publicGames.push({
                id : game_.id,
                white: {
                    name: whitePlayer.name,
                    title: whitePlayer.title,
                    displayName: whitePlayer.displayName,
                    rating: whitePlayer.rating
                },
                black: {
                    name: blackPlayer.name,
                    title: blackPlayer.title,
                    displayName: blackPlayer.displayName,
                    rating: blackPlayer.rating
                },
                time : game_.time,
                increment : game_.increment
            });
        }

        socket.emit("activeGameUpdate", {activeGames: publicGames});
    });
};

//emit message to all spectators of the game
utils.emitSpectators = function(game, message, object)
{
    for (user in game.spectators) {
        if (game.spectators[user]) {
            game.spectators[user].emit(message, object);
        }
    }
};

module.exports = utils;
