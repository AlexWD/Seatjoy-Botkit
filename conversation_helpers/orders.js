module.exports = function (controller) {
  this.config = controller.config.botConfig;

  this.displayMainMenu = (bot, message) =>  {
   let elements = [];

   // each generic template supports a maximum of 3 buttons
   // For every 3 buttons we need a new generic template element

   let menuItems = this.config.menuItems;
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
}
