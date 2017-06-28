const request = require('request');

module.exports = function(controller) {
    const orderHelper = new (require('../conversation_helpers/orders.js'))(controller);

    // TODO: this is being called on the SENT messages too, filter those out by user ID
    controller.middleware.receive.use(function(bot, message, next) {
      if (message.user == controller.config.botConfig.page_id) {
        console.log('message from page');
        return next('message from page');
      }
      // do something...
      console.log('RCVD:', message);
      let emptyOrder = {
        totalPrice: 0,
        totalTaxes: 0,
        items: []
      };
      controller.storage.users.get(message.user, function(err, user) {
        if (!user) {
          // no session yet for this user, intialize one

          console.log("User_id: " + message.user);

          request({
            url: `https://graph.facebook.com/v2.6/${message.user}?fields=first_name,last_name,profile_pic,locale,timezone,gender&access_token=${controller.config.botConfig.page_token}`
          }, (err, response, body) => {
            if (err) {
              console.log(err);
            } else {
              let data = JSON.parse(body);

              user = {
                orderData: emptyOrder,
                id: message.user,
                first_name: data.first_name,
                profile_pic: data.profile_pic,
                last_name: data.last_name,
                last_seen_at: Date.now()
              };

              // save user in bot local storage
              controller.storage.users.save(user, function(err, saved) {
                if (err) {
                  console.log('error saving user data: ' + err);
                } else {
                  console.log('user data saved');
                  next();
                }
              });

              request({
                url: `https://b52253fc.ngrok.io/create/user`,
                headers: {
                  "Content-Type": "application/json"
                },
                method: "POST",
                body: JSON.stringify({
                    "messenger user id" : message.user,
                    "first name" : data.first_name,
                    "last name" : data.last_name,
                    "email" : "",
                    "profile url pic": data.profile_pic
                })
              }, (error, response, body) => {
                if (error) {
                  console.log(error);
                } else {
                  console.log(body);
                }
              });
            }
          });
        } else {
          // 30 minute session timeout
          let resetOrder = false;
          if (Date.now() - user.last_seen_at > 1000 * 60 * 30) {
            // reset session
            // end any active conversations
            user.orderData = emptyOrder;
            console.log('session reset');
            resetOrder = true;
            bot.findConversation(message, function(convo) {
                if (convo) {
                    convo.stop();
                }
            });
          }
          // update user's last seen time
          user.last_seen_at = Date.now();

          controller.storage.users.save(user, function(err, saved) {
            if (err) {
              console.log('error saving user data: ' + err);
            } else {
              if (resetOrder) {
                orderHelper.displayMainMenu(bot, message);
                return next('Session reset');
              } else {
                next();
              }
            }
          });
        }
      });
    });
    //
    //
    // controller.middleware.send.use(function(bot, message, next) {
    //
    //     // do something...
    //     console.log('SEND:', message);
    //     next();
    //
    // });

}
