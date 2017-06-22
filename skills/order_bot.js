const request = require('request');

// const merchant = {
//   merchant_id: "19K4BY3C9DR55",
//   authToken: "sq0atp-vmPijA4wPGN9mwF-dKjZ-A"
// };

const merchant = {
  merchant_id: process.env.SQUARE_MERCHANT_ID,
  access_token: process.env.SQUARE_ACCESS_TOKEN
};

const menuItems = [];

module.exports = function(controller) {
  // configure persistent menu
  controller.api.messenger_profile.menu([{
    "locale": "default",
    "call_to_actions": [{
        "type": "postback",
        "title": "Menu",
        "payload": "MainMenu"
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

  // Load POS API data for the bot
  request({
    url: `https://connect.squareup.com/v1/${merchant.merchant_id}/items`,
    headers: {
      "Authorization": `Bearer ${merchant.access_token}`
    }
  }, (error, response, body) => {
    if (error) {
      console.log(error);
    } else {
      let items = JSON.parse(body);
      items.map(item => {
        let cat = item.category ? item.category.name : 'other';

        if (!Array.isArray(menuItems[cat])) {
          menuItems[cat] = [];
        }

        let variations = item.variations.length < 2 ? [] : item.variations.map(variation => {
          return {
            name: variation.name,
            price: variation.price_money ? variation.price_money.amount / 100 : 0
          };
        });

        menuItems[cat][item.id] = {
          id: item.id,
          name: item.name,
          title: '',
          description: item.description,
          image: item.master_image ? item.master_image.url : '',
          price: item.variations[0].price_money ? item.variations[0].price_money.amount / 100 : 0,
          taxes: 0,
          options: variations
        };
      });

    }
  });



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

  // facebook postback controller, this handles top level responses e.g. selecting menus/items
  controller.on('facebook_postback', function(bot, message) {
    let [action, ...details] = message.payload.split('/');

    console.log('payload:' + message.payload);

    switch (action) {
      case 'Menu':
        let [menuCategory] = details;
        displayItems(bot, message, menuCategory);
        break;
      case 'SelectItem':
        let [menuCat, itemId] = details;
        let item = menuItems[menuCat][itemId];

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
        break;
      case 'MainMenu':
        resetOrder(message);

        // TODO: integrate messenger profile API to get name
        bot.reply(message, "Welcome to Seatjoy food service!");

        displayMainMenu(bot, message);
        break;
      default:
        break;
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
                displayReceiptCard(bot, message, user.orderData);
                break;
              case "AddMore":
                displayMainMenu(bot, message);
                break;
              case "Restart":
                resetOrder(message);
                bot.reply(message, "Order Canceled");
                displayMainMenu(bot, message);
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

  function displayItems(bot, message, menuCategory) {
    let elements = [];

    let subMenu = menuItems[menuCategory];

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

  function displayMainMenu(bot, message) {
    let elements = [];

    // each generic template supports a maximum of 3 buttons
    // For every 3 buttons we need a new generic template element

    let menuCategories = Object.keys(menuItems);

    // sort categories based on average price of items
    menuCategories.sort((a, b) => {
    	let aAvg = Object.keys(menuItems[a]).reduce((c, d) => c + menuItems[a][d].price, 0) / Object.keys(menuItems[a]).length;
    	let bAvg = Object.keys(menuItems[b]).reduce((c, d) => c + menuItems[b][d].price, 0) / Object.keys(menuItems[b]).length;

    	return bAvg - aAvg;
    });

    // always put the other category at the end
    let otherIndex = menuCategories.indexOf("other");
    if (otherIndex !== -1) {
      menuCategories.splice(menuCategories, 1);
      menuCategories.push("other");
    }

    for (let i = 0; i < menuCategories.length / 3; i++) {
      elements.push({
        "title": "Our Menu",
        "image_url": "https://imagizer.imageshack.us/592x600f/923/yIDwcC.png",
        "subtitle": "We are pleased to offer you a wide-range of menu for lunch or dinner",
        "buttons": menuCategories.slice(i * 3, i * 3 + 3).map((menuCategory => {
          return {
            type: "postback",
            title: `${menuCategory} Menu`,
            payload: `Menu/${menuCategory}`
          };
        }))
      });
    }

    // add hours and directions element

    elements.push({
      "title": "Hours and Directions",
      "image_url": "http://imagizer.imageshack.us/600x450f/924/og9BY2.jpg",
      "buttons": [{
          "type": "postback",
          "title": "Location and Hours",
          "payload": "/locationsMenu"
        },
        {
          "type": "web_url",
          "title": "Contact",
          "url": "http://www.phatthaisf.com/contact.html"
        }
      ]
    });

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
      url: `https://graph.facebook.com/v2.6/${message.user}?fields=first_name,last_name,profile_pic,locale,timezone,gender&access_token=${process.env.page_token}`
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
              "url": `https://seatjoy-mvp.herokuapp.com/payment/page?fb_first_name=${data.first_name}&fb_id=${message.user}&profile_pic=${data.profile_pic}&fb_last_name=${data.last_name}&merchant_id=${merchant.merchant_id}&location_id=${merchant.merchant_id}&items=${orderItems}&price=${totalPrice}`,
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

    displayMainMenu(bot, message);
  });

  // controller.hears('.*', 'message_received', function (bot, message) {
  //   bot.reply(message, "I'm sorry, I didn't understand that");
  // })
}
