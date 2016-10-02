function stockfishWorker(opts, name) {

    var instance = null;
    var busy = false;
    var stopping = false;

    var send = function(text) {
        instance.postMessage(text);
    };

    var processOutput = function(text, work) {
        if (text.indexOf('bestmove ') === 0) {
            busy = false;
            stopping = false;
            return;
        }
        if (stopping) return;
        if (/currmovenumber|lowerbound|upperbound/.test(text)) return;
        var matches = text.match(/depth (\d+) .*score (cp|mate) ([-\d]+) .*nps (\d+) .*pv (.+)/);
        if (!matches) return;
        var depth = parseInt(matches[1]);
        if (depth < opts.minDepth) return;
        var cp, mate;
        if (matches[2] === 'cp') cp = parseFloat(matches[3]);
        else mate = parseFloat(matches[3]);
        if (work.ply % 2 === 1) {
            if (matches[2] === 'cp') cp = -cp;
            else mate = -mate;
        }
        var best = matches[5].split(' ')[0];
        work.emit({
            work: work,
            eval: {
                depth: depth,
                cp: cp,
                mate: mate,
                best: best,
                nps: parseInt(matches[4])
            },
            name: name
        });
    };

    var reboot = function() {
        if (instance) instance.terminate();
        instance = new Worker('js/stockfish.js');
        busy = false;
        stopping = false;
        var uciVariant = opts.variant;
        if (uciVariant) send("setoption name UCI_Variant value " + uciVariant);
        else send('uci'); // send something to warm up
    };

    reboot();

    return {
        start: function(work) {
            if (busy) reboot();
            busy = true;
            send(['position', 'fen', work.initialFen, 'moves'].concat(work.moves).join(' '));
            send('go depth ' + work.maxDepth);
            instance.onmessage = function(msg) {
                console.log(msg.data);
                processOutput(msg.data, work);
            };
        },
        stop: function() {
            if (!busy) return;
            stopping = true;
            send('stop');
        }
    };
}