module.exports = function (webserver, controllers) {

  webserver.get('/payment/receive/:botid/:psid', function (req, res) {
    let botid = req.params.botid;
    let psid = req.params.psid;

    let controller = controllers[botid];

    if (controller) {
      var bot = controller.spawn({});

      bot.reply({ channel: psid }, "Payment Received!");

      res.status(200);
      res.send('ok');
    }
  });
}
