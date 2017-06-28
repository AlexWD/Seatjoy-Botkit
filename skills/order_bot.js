const request = require('request');

// const merchant = {
//   merchant_id: "19K4BY3C9DR55",
//   authToken: "sq0atp-vmPijA4wPGN9mwF-dKjZ-A"
// };
//
// const merchant = {
//   merchant_id: process.env.SQUARE_MERCHANT_ID,
//   access_token: process.env.SQUARE_ACCESS_TOKEN
// };

module.exports = function(controller) {
  const orderHelper = new (require('../conversation_helpers/orders.js'))(controller);

  let botConfig = controller.config.botConfig;
  // configure persistent menu
  controller.api.messenger_profile.menu([{
    "locale": "default",
    "call_to_actions": [{
        "type": "postback",
        "title": "Menu",
        "payload": "Main Menu"
      },{
        type: "nested",
        title: "More",
        call_to_actions: [{
          "title": "Locations",
          "type": "postback",
          "payload": "Locations"
        }]
      }
    ]
  }]);

  //whitelist domain for messenger extensions
  controller.api.messenger_profile.domain_whitelist('https://sjd.ngrok.io');

  function resetOrder(message) {
    let emptyOrder = {
      totalPrice: 0,
      totalTaxes: 0,
      items: []
    };
    controller.storage.users.get(message.user, function(err, user) {
      if (!user) {
        user = {
          orderData: emptyOrder,
          id: message.user
        };
      } else {
        user.orderData = emptyOrder;
      }

      controller.storage.users.save(user, function(err, saved) {
        if (err) {
          console.log('error saving user data: ' + err);
        } else {
          console.log('user data saved');
        }
      });
    });
  }

  controller.hears([/^Menu\/*/i], 'message_received', function(bot, message) {
    let [action, ...details] = message.text.split('/');
    let [menuCategory] = details;

    displayItems(bot, message, menuCategory);
  });

  controller.hears([/^SelectItem\/*/i], 'message_received', function(bot, message) {
    let [action, ...details] = message.text.split('/');
    let [menuCat, itemId] = details;
    let item = botConfig.menuItems[menuCat][itemId];

    // handle menu item options
    if (item.options.length > 1) {
      bot.startConversation(message, function(err, convo) {
        convo.ask({
          "text": `Now, select your ${item.name}`,
          "quick_replies": item.options.map((option, idx) => ({
            content_type: "text",
            "title": `${option.name} $${option.price}`,
            payload: idx
          }))
        }, function(response, convo) {
          if (response.quick_reply) {
            let newItem = Object.assign({}, item);
            newItem.options = [item.options[response.quick_reply.payload]];

            addItemToOrder(bot, message, newItem);

            convo.next();
          }
        })
      });
    } else {
      addItemToOrder(bot, message, item);
    }
  });

  function addItemToOrder(bot, message, item) {
    // add item to order details
    // display order details
    // prompt confirm order, add more items, cancel
    controller.storage.users.get(message.user, function(err, user) {
      user.orderData.items.push(item);

      let orderDetails = getOrderDetails(user.orderData);

      bot.startConversation(message, function(err, convo) {
        convo.say(orderDetails);
        convo.ask({
          "text": "Please Select:",
          "quick_replies": [{
              "content_type": "text",
              "title": "Confirm Order",
              "payload": "Confirm"
            },
            {
              "content_type": "text",
              "title": "Add more items",
              "payload": "AddMore"
            },
            {
              "content_type": "text",
              "title": "Restart Order",
              "payload": "Restart"
            }
          ]
        }, function(response, convo) {
          // if the user responds with something other than a quick reply option
          // response.text
          if (response.quick_reply) {
            switch (response.quick_reply.payload) {
              case "Confirm":
                // display receipt card
                displayPayButton(bot, message, user.orderData);
                break;
              case "AddMore":
                orderHelper.displayMainMenu(bot, message);
                break;
              case "Restart":
                resetOrder(message);
                bot.reply(message, "Order Canceled");
                orderHelper.displayMainMenu(bot, message);
                break;
            }
          }
          convo.next();
        });
      });
    });
  }

  function getOrderDetails(orderData) {
    let msg = '';
    let totalPrice = 0;
    orderData.items.forEach(item => {
      if (item.options.length > 0) {
        item.options.forEach(option => {
          msg += option.name + ' - $' + option.price + '\n\n';
          //session.userData.orderDetails.totalPrice += option.price;
          totalPrice += option.price;
        });
      } else {
        msg += item.name + ' - $' + item.price + '\n\n';
        totalPrice += item.price;
        //session.userData.orderDetails.totalPrice += item.price;
      }

    });

    msg += '*Total - $' + totalPrice + '*';

    return msg;
  }

  let displayItems = (bot, message, menuCategory) => {
    let elements = [];

    let subMenu = botConfig.menuItems[menuCategory];

    // add items to dialog
    for (let itemId in subMenu) {
      let item = subMenu[itemId];
      elements.push({
        "title": item.name + ' - $' + item.price + ' ' + item.title,
        "image_url": item.image,
        "subtitle": item.description,
        "buttons": [{
          type: "postback",
          title: "Select",
          payload: `SelectItem/${menuCategory}/${item.id}`
        }]
      });
    };

    // add back button
    // elements.push({
    //   buttons: [
    //   {
    //     type: "postback",
    //     title: "Back",
    //     payload: "back"
    //   }
    //   ]
    // })

    var attachment = {
      "type": "template",
      "payload": {
        "template_type": "generic",
        "elements": elements
      }
    };

    bot.reply(message, {
      attachment: attachment
    });
  }

  function displayPayButton(bot, message, orderDetails) {
    let totalPrice = 0;
    let totalTaxes = 0;

    orderDetails.items.forEach(item => {
      // if an item has an option, that's the option selected
      let price = item.options.length ? item.options[0].price : item.price;
      totalPrice += price;
    });
    request({
      url: `https://graph.facebook.com/v2.6/${message.user}?fields=first_name,last_name,profile_pic,locale,timezone,gender&access_token=${botConfig.page_token}`
    }, (err, response, body) => {
      if (err) {
        console.log(err);
      } else {
        let data = JSON.parse(body);

        let orderItems = orderDetails.items.map(item => item.name).join('|');

        let payAttachment = {
          "type": "template",
          "payload": {
            "template_type": "button",
            "text": "Click below to pay for your order",
            "buttons": [{
              "type": "web_url",
              "messenger_extensions": true,
              "url": `https://sjd.ngrok.io/payment/page?botid=${botConfig.id}&fb_first_name=${data.first_name}&fb_id=${message.user}&profile_pic=${data.profile_pic}&fb_last_name=${data.last_name}&merchant_id=${botConfig.square_merchant_id}&location_id=${botConfig.square_merchant_id}&items=${orderItems}&price=${totalPrice}`,
              "title": "Pay"
            }]
          }
        };

        bot.reply(message, {
          attachment: payAttachment
        });
      }
    })
  }

  function displayReceiptCard(bot, message, orderDetails) {
    let elements = [];
    let totalPrice = 0;
    let totalTaxes = 0;

    orderDetails.items.forEach(item => {
      // if an item has an option, that's the option selected
      let name = item.options.length ? item.options[0].name : item.name;
      let price = item.options.length ? item.options[0].price : item.price;

      elements.push({
        title: name,
        price: price,
        currency: "USD",
        quantity: 1,
        image_url: item.image
      });
      totalPrice += price;
    });

    let receiptAttachment = {
      "type": "template",
      "payload": {
        "template_type": "receipt",
        "recipient_name": "Stephane Crozatier",
        "order_number": "12345678902",
        "currency": "USD",
        "payment_method": "Visa 2345",
        "elements": elements,
        // "address":{
        //   "street_1":"1 Hacker Way",
        //   "street_2":"",
        //   "city":"Menlo Park",
        //   "postal_code":"94025",
        //   "state":"CA",
        //   "country":"US"
        // },
        "summary": {
          "subtotal": totalPrice,
          // "shipping_cost":4.95,
          "total_tax": 0,
          "total_cost": totalPrice
        },
        "adjustments": [{
            "name": "New Customer Discount",
            "amount": 20
          },
          {
            "name": "$10 Off Coupon",
            "amount": 10
          }
        ]
      }
    };

    // bot.reply(message, {
    //   attachment: attachment
    // });

    // display pay button
    request({
      url: `https://graph.facebook.com/v2.6/${message.user}?fields=first_name,last_name,profile_pic,locale,timezone,gender&access_token=${botConfig.page_token}`
    }, (err, response, body) => {
      if (err) {
        console.log(err);
      } else {
        let data = JSON.parse(body);

        let orderItems = orderDetails.items.map(item => item.name).join('|');

        let payAttachment = {
          "type": "template",
          "payload": {
            "template_type": "button",
            "text": "Click below to pay for your order",
            "buttons": [{
              "type": "web_url",
              "messenger_extensions": true,
              "url": `https://b52253fc.ngrok.io/payment/page?botid=${botConfig.id}&fb_first_name=${data.first_name}&fb_id=${message.user}&profile_pic=${data.profile_pic}&fb_last_name=${data.last_name}&merchant_id=${botConfig.square_merchant_id}&location_id=${botConfig.square_merchant_id}&items=${orderItems}&price=${totalPrice}`,
              "title": "Pay"
            }]
          }
        };

        bot.startConversation(message, function(err, convo) {
          convo.say({
            attachment: receiptAttachment
          });
          convo.say({
            attachment: payAttachment
          });
        }, function(response, convo) {
          convo.next();
        });

        // bot.reply(message, {
        //   attachment: payAttachment
        // })
      }
    })
  }

  controller.hears([/getstarted/i, /get started/i, /main menu/i], 'message_received', function(bot, message) {
    resetOrder(message);

    console.log('get started called');

    // TODO: integrate messenger profile API to get name
    bot.reply(message, "Welcome to Seatjoy food service!");

    orderHelper.displayMainMenu(bot, message);
  });

  // controller.hears('.*', 'message_received', function (bot, message) {
  //   bot.reply(message, "I'm sorry, I didn't understand that");
  // })
}
