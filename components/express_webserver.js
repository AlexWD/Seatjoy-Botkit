var express = require('express');
var bodyParser = require('body-parser');
var querystring = require('querystring');
var debug = require('debug')('botkit:webserver');

module.exports = function(controllers, bot) {


    var webserver = express();
    webserver.use(bodyParser.json());
    webserver.use(bodyParser.urlencoded({ extended: true }));

    // import express middlewares that are present in /components/express_middleware
    // var normalizedPath = require("path").join(__dirname, "express_middleware");
    // require("fs").readdirSync(normalizedPath).forEach(function(file) {
    //     require("./express_middleware/" + file)(webserver, controller);
    // });

    webserver.use(function(req, res, next) {
      res.header("Access-Control-Allow-Origin", "https://sjd.ngrok.io");
      next();
    });

    webserver.use(express.static('public'));


    webserver.listen(process.env.PORT || 3000, null, function() {

        debug('Express webserver configured and listening at http://localhost:' + process.env.PORT || 3000);

    });

    // import all the pre-defined routes that are present in /components/routes
    var normalizedPath = require("path").join(__dirname, "routes");
    require("fs").readdirSync(normalizedPath).forEach(function(file) {
      require("./routes/" + file)(webserver, controllers);
    });

    Object.keys(controllers).forEach(botid => {
      let controller = controllers[botid];
      controller.webserver = webserver;
    })

    return webserver;

}
