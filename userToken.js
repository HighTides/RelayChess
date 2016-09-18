var crypto = require("crypto");

function createUserToken(user)
{
    //create token from the hash name and expire date
    var token = {
        name: user.name,
        hash: crypto.createHash("sha256").update(user.passwordHash).digest("hex"),
        expire: Date.now(),
        signature: ""
    };

    token.signature = crypto.createHash("sha256")
    .update(token.name + token.hash + token.expire + "THIS IS A SECRET<>")
    .digest("hex");

    return token;
}

function validateUserToken(token)
{
    try{
        var signature = crypto.createHash("sha256")
        .update(token.name + token.hash + token.expire + "THIS IS A SECRET<>")
        .digest("hex");

        return (token.signature == signature);
    }
    catch(ex)
    {
        return false;
    }
}

module.exports = {
    createUserToken: createUserToken,
    validateUserToken: validateUserToken
};