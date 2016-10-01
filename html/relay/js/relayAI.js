function relayChessAI(){

    _.mixin({
        // same as _.range but returns the alphabetic equivalent
        alphaRange: function(start, stop) {
            var alpha = "abcdefghijklmnopqrstuvwxyz";
            return _.map(_.range(start, stop), function(i) { return alpha[i] });
        },
        // return a string with the first instance of the character replaced
        removeFirst: function(str, c) {
            var i = str.indexOf(c);
            return str.slice(0, i) + str.slice(i+1, str.length);
        },
        // a boolean of whether a character is upper case
        isUpperCase: function(c) {
            return c == c.toUpperCase();
        },
        tally: function(arr) {
            var r = {};
            _.each(arr, function(c) {
                r[c] = r[c] ? r[c] + 1 : 1;
            });
            return r;
        }
    });
    

    var alpha = -999999999;
    var beta  =  999999999;


    /* Really dumb eval function:
     *
     * f(p) = 200(K-K')
     *        + 9(Q-Q')
     *        + 5(R-R')
     *        + 3(B-B' + N-N')
     *        + 1(P-P')
     *        - 0.5(D-D' + S-S' + I-I')
     *        + 0.1(M-M') + ...
     *
     * KQRBNP = number of kings, queens, rooks, bishops, knights and pawns
     * D,S,I = doubled, blocked and isolated pawns
     * M = Mobility (the number of legal moves)
     *
     */

    //relay evaluation
    //evaluate piece diversity (B+N > (B+B | N+N))

    //generate lookup table
    var RANK = {};

    _.each({k: -200, q: -9, r: -5, b: -3, n: -3, p: -1}, function(val, key) {
        RANK[key] = val;
        RANK[key.toUpperCase()] = val * -1;
    });


// score the chess game based on the above algorithm.
    function score(chess) {
        var pieces = _.toArray(fen_pieces(chess));
        var tally = _.tally(pieces);
        var s = 0;
        var turn = -1;
        if (chess.turn() == 'b')
        {
            turn = 1;//white just moved, evaluate from white's perspective
        }
        _.each(tally, function(val, p) {
            s = s + val*RANK[p];
        });
        return s * turn;
    }

    function fen_pieces(chess) {
        return chess.fen().split(' ')[0].replace(/\//g, '').replace(/\d/g, '');
    }

    function startAlphaBeta(tchess, depth)
    {
        var best_score = -9999;
        var best_move = '';
        var tempchess = new Chess(tchess.fen());
        var moves = tempchess.moves();
        for (var index = 0; index < moves.length; index++)
        {
            tempchess.move(moves[index]);
            var move_score;
            if (tempchess.in_checkmate()){
                move_score = 9998;//last player to make move won
            } else{
                if (depth == 0)
                {
                    move_score = score(tempchess);
                }
                else {
                    move_score = -alphaBeta(tempchess, depth-1);
                }
            }
            if (move_score > best_score){
                best_score = move_score;
                best_move = moves[index];
            }
            tempchess.undo_move();
        }
        return best_move;
    }

    function alphaBeta(tempchess,depth)
    {
        console.log(depth);
        var best_score = -9999;
        var moves = tempchess.moves({raw: true});
        for (var index = 0; index < moves.length; index++)
        {
            tempchess.make_move(moves[index]);
            var move_score;
            if (tempchess.in_checkmate()){
                move_score = 9998;//last player to make move won
            } else{
                if (depth == 0)
                {
                    move_score = score(tempchess);
                }
                else {
                    move_score = -alphaBeta(tempchess, depth-1);
                }
            }
            if (move_score > best_score){
                best_score = move_score;
            }
            tempchess.undo_move();
        }
        return best_score;
    }

    this.searchNextMove = startAlphaBeta;
}
