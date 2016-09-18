module.exports = {
    updateDNS : function(dns, token, complete) {
        var http = require('http');

        var options = {
            host: 'anondns.net',
            path: '/api/set/' + dns + '.anondns.net/' + token
        };

        callback = function(response) {
            var str = '';

            //another chunk of data has been recieved, so append it to `str`
            response.on('data', function (chunk) {
                str += chunk;
            });

            //the whole response has been recieved, so we just print it out here
            response.on('end', function () {
                if(complete)
                    complete(str);
            });
        }

        http.request(options, callback).end();
    }
};
