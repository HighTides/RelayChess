var io = require("./socketConnection");
var co = require("co");
var _ = require("underscore");

//app modules
var data = require("../data");
var utils = require("./utils");

var chess = require("../chess");

//chess game class
module.exports = function(white, black, time, increment){
    this.id = "";

    this.white = {
            name: white,
            socket: null,
            ready: false,
            time: time,
            resign: false
        };

    this.black = {
            name: black,
            socket: null,
            ready: false,
            time: time,
            resign: false
        };

    this.time = time;
    this.increment = increment;

    this.playing = false;
    this.timing = false;

    //timeout for game finalization
    this.currentTimeout = null;
    this.lastMoveTime = null;

    this.chess = new chess.Chess();

    this.getAdjustedPlayerTime = function(){
        if(!this.timing || this.lastMoveTime == null){
            return { white: this.white.time, black: this.black.time };
        }

        var timeSpent = (Date.now() - this.lastMoveTime) / (60 * 1000);

        if(this.chess.turn() == "w"){
            return { white: this.white.time - timeSpent, black: this.black.time };
        }
        else{
            return { white: this.white.time, black: this.black.time - timeSpent };
        }
    };

    this.isUsernamePlaying = function(username){
        return this.white.name == username || this.black.name == username;
    };

    this.readyUp = function(username, socket){
        if(this.white.name == username){
            this.white.ready = true;
            this.white.socket = socket;
            return;
        }

        if(this.black.name == username){
            this.black.ready = true;
            this.black.socket = socket;
            return;
        }
    };

    this.isGameReady = function(){
        return this.white.ready && this.black.ready;
    };

    this.getColorForUsername = function(username){
        if(this.white.name == username){
            return "w";
        }

        if(this.black.name == username){
            return "b";
        }

        return null;
    };

    this.getOpponent = function(username){
        if(this.white.name == username){
            return this.black;
        }

        if(this.black.name == username){
            return this.white;
        }

        return null;
    }

    this.getUsernameForColor = function(color){
        //return the user who's turn it is
        if(color == "w"){
            return this.white;
        }

        if(color == "b"){
            return this.black;
        }

        return null;
    };
};