var io = require("./socketConnection");
var co = require("co");
var _ = require("underscore");

//app modules
var data = require("../data");
var userToken = require("../userToken");

module.exports = {
    getDatabaseUserByName: function(name)
    {
        var user = data.userCollection.findOne({name: name}, {name:1, displayName:1, title:1, rating:1});

        return user;
    },

    getServerUserBySocket: function(socket)
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
    },

    generateGameID: function()
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
    },

    emitLobbyUpdate: function(socket)
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

        socket.emit("lobbyUpdate", {users: publicUsers});
    },

    emitSeeksUpdate: function(socket)
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
                increment: seek_.increment
            });
        }

        socket.emit("seekUpdate", {seeks: publicSeeks});
    }
};
