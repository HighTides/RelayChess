module.exports = {
    getNewRatings: function(whiteRating, blackRating, result, kWhite = 32, kBlack = 32){
        //calculate expected result
        var whiteExpectedRaw = Math.pow(10, whiteRating / 400);
        var blackExpectedRaw = Math.pow(10, blackRating / 400);

        var whiteExpected = whiteExpectedRaw / (whiteExpectedRaw + blackExpectedRaw);
        var blackExpected = blackExpectedRaw / (whiteExpectedRaw + blackExpectedRaw);

        var whiteAdjusted = Math.round(whiteRating + kWhite * (result - whiteExpected));
        var blackAdjusted = Math.round(blackRating + kBlack * ((1 - result) - blackExpected));

        return { white: whiteAdjusted, black: blackAdjusted };
    }
};