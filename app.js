//TODO: 2FA (authy?) to avoid collecting passwords
var crypto = require("crypto");
var express = require("express");
var mongodb = require("mongodb");

var co = require("co");
var _ = require("underscore");

//app modules
var config = require("./config");
var data = require("./data");
var userToken = require("./userToken");
var socketGameServer = require("./socketServer/socketServer");

var MongoClient = mongodb.MongoClient;

var app = express();

//enable cors
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.get('/', function(req, res, next) {
  // Handle the get for this route
});

app.post('/', function(req, res, next) {
 // Handle the post for this route
});


//sanity check our inputs
function checkUserPasswordInput(req)
{
    if(!("username" in req.query) || !_.isString(req.query.username) ||
       !(/^[0-9a-z]{3,20}$/i).test(req.query.username))
    {
        //username invalid
        return false;
    }

    if(!("password" in req.query) || !_.isString(req.query.password) ||
       !(/^.{3,20}$/).test(req.query.password))
    {
        //password invalid
        return false;
    }

    return true;
}

//login
app.get("/login", function(req, res){
    co(function*(){
        //sanity check
        if(!checkUserPasswordInput(req))
        {
            res.json({result:false, reason: "invalid request"});
            return;
        }

        //get username & password
        var username = req.query.username;
        var password = req.query.password;

        username = username.toLowerCase();

        //check if username exists
        var userQuery = yield data.userCollection.findOne({"name": username});

        if(userQuery == null)
        {
            //no users with this name found
            res.json({result:false, reason: "username doesn't exist"});
            return;
        }

        //verify password
        var salt = userQuery.passwordSalt;
        var hash = crypto.createHash("sha256").update(password + salt).digest("hex");

        if(hash === userQuery.passwordHash)
        {
            //hash matches

            //generate login token
            var token = JSON.stringify(userToken.createUserToken(userQuery));

            res.json({result:true, token: token});
        }
        else
        {
            //hash doesnt match
            res.json({result:false, reason: "wrong password"});
        }
    });
});

//register
app.get("/register", function(req, res){
    co(function*(){
        if(!checkUserPasswordInput(req))
        {
            res.json({result:false, reason: "invalid request"});
            return;
        }

        //get username & password
        var username = req.query.username.toLowerCase();
        var displayName = req.query.username;
        var password = req.query.password;

        //check if username exists
        var userQuery = yield data.userCollection.findOne({"name": username});

        if(userQuery != null)
        {
            //users with this name found
            res.json({result:false, reason: "username already exist"});
            return;
        }

        //salt and hash password
        var salt = crypto.randomBytes(16).toString("hex");
        var hash = crypto.createHash("sha256").update(password + salt).digest("hex");

        var newUser = {
            ip: req.connection.remoteAddress,
            name: username, 
            displayName: displayName,
            passwordHash: hash,
            passwordSalt: salt,
            title: "",
            rating: {r: 1500, rd: 350.0, vol: 0.06}
        };

        var insertResult = yield data.userCollection.insertOne(newUser);

        //generate login token
        var token = JSON.stringify(userToken.createUserToken(newUser));

        //done
        res.json({result:true, token: token});
    });
});

//getUserInfo
app.get("/getUserInfo", function(req, res){
    console.log("getUserInfo request");
    res.send("getUserInfo");
});

//connect to db
MongoClient.connect(config.databaseURL, function (err, database) {
    if (err)
    {
        console.log("Unable to connect to the mongoDB server. Error:", err);
    } 
    else 
    {
        console.log("Connected to the mongoDB server.");
        data.database = database;
        data.gameCollection = database.collection("games");
        data.userCollection = database.collection("users");

        //start the server
        app.listen(config.apiServerPort, function(){
            console.log("api server running");

            socketGameServer.startServer();
            console.log("socket server running");
        });
    }
});

