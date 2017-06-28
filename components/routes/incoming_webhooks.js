var debug = require('debug')('botkit:incoming_webhooks');

module.exports = function(webserver, controllers) {

    debug('Configured POST /facebook/receive url for receiving events');
    webserver.post('/facebook/:botid', function(req, res) {
        let botid = req.params.botid;

        // NOTE: we should enforce the token check here

        // respond to Slack that the webhook has been received.
        res.status(200);
        res.send('ok');

        let controller = controllers[botid];

        if (controller) {
          var bot = controller.spawn({});

          // Now, pass the webhook into be processed
          controller.handleWebhookPayload(req, res, bot);
        }
    });

    debug('Configured GET /facebook/receive url for verification');
    webserver.get('/facebook/:botid', function(req, res) {
        let botid = req.params.botid;
        if (req.query['hub.mode'] == 'subscribe') {
            if (req.query['hub.verify_token'] == controllers[botid].config.verify_token) {
                res.send(req.query['hub.challenge']);
            } else {
                res.send('OK');
            }
        }
    });

}
