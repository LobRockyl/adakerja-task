require("dotenv").config();
const request = require("request");
const Message = require("../models/Message");

// global variables used for conversation information
let USER_FIRST_NAME = "";
let USER_BIRTH_DATE = "";
let LATEST_MESSAGE = "";
let PREV_OF_LATEST = "";
let PREV_OF_PREV = "";
let WEBHOOK_MESS = "";
let SENDER_ID = "";
let COUNT_MESSAGES = 0;

// function to check whether user is in DB
// and, if successful, return position in DB
function checkInDB(arrMess, givenId=SENDER_ID){
    for(let i = 0; i < arrMess.length; i++){
        if(arrMess[i].senderId === givenId){
            return i;
        }
    }
    return -1;
}

// function to add a message to DB
let postMessage = (req, res) => {
    if ((COUNT_MESSAGES % 2) == 0)
        return;

    let MongoClient = require('mongodb').MongoClient;

    // creating the message object
    let obj = new Message({
        senderId: SENDER_ID,
        text: [WEBHOOK_MESS]
    });

    console.log("OBJ: " + obj);

    MongoClient.connect(
        process.env.DB_CONNECTION, {
            auth: {
                user: process.env.MONGO_DB_USER,
                password: process.env.MONGO_DB_PASSWORD
            }
        },
        {
            useNewUrlParser: true, 
            useUnifiedTopology: true
        }, 
        function(err, client) {
            if (err){
                throw err;
            } 
            
            console.log("Connected to the server for inserting message");

            // Get database name
            let db = client.db(process.env.DB_NAME);

            // we search if user already in database
            db.collection(process.env.DB_COLLECTION).find({}).toArray(function(err, result) {
                if (err){
                    throw err;
                }

                console.log("Display data: " + result);

                // check whether user is in DB
                let posInDB = checkInDB(result);

                // if user is not in DB
                if (posInDB < 0){
                    db.collection(process.env.DB_COLLECTION).insertOne(obj, function(error, res) {
                        if (error) {
                            throw error;
                        }
                        
                        console.log("1 message inserted for not in DB userId=" + SENDER_ID);
                        client.close();
                    });
                }
                // user is in DB
                else{
                    let usrArrMess = result[posInDB].text;
                    console.log("User messages: " + usrArrMess);

                    let newText = [];
                    for (let i = 0; i < usrArrMess.length; i++)
                        newText.push(usrArrMess[i]);
                    newText.push(WEBHOOK_MESS);

                    // or with spread operator
                    // newText = [...usrArrMess];

                    db.collection(process.env.DB_COLLECTION).update(
                        {_id : result[posInDB]._id},
                        {$set : {text : newText}}
                    )

                    console.log("1 message inserted for in DB userId=" + SENDER_ID);
                    client.close();
                }
            });
        }
    );
}

let postWebhook = (req, res) => {
    // Parse the request body from the POST
    let body = req.body;

    // Check the webhook event is from a Page subscription
    if (body.object === 'page') {

        // Iterate over each entry - there may be multiple if batched
        body.entry.forEach(function(entry) {

            // Gets the body of the webhook event
            let webhook_event = entry.messaging[0];
            console.log(webhook_event);

            // Get the sender PSID
            let sender_psid = webhook_event.sender.id;
            SENDER_ID = webhook_event.sender.id;
            console.log('Sender PSID: ' + sender_psid);

            // Check if the event is a message or postback and
            // pass the event to the appropriate handler function
            if (webhook_event.message) {
                COUNT_MESSAGES += 1;

                WEBHOOK_MESS = webhook_event.message.text;

                postMessage(req, res);
                handleMessage(sender_psid, webhook_event.message);
            } else if (webhook_event.postback) {
                COUNT_MESSAGES += 1;

                postMessage(req, res);
                WEBHOOK_MESS = webhook_event.postback.payload;
                handlePostback(sender_psid, webhook_event.postback);
            }

        });

        // Return a '200 OK' response to all events
        res.status(200).send('EVENT_RECEIVED');

    } else {
        // Return a '404 Not Found' if event is not from a page subscription
        res.sendStatus(404);
    }
};

let getWebhook = (req, res) => {
    // Your verify token. Should be a random string.
    let VERIFY_TOKEN = process.env.VERIFY_TOKEN;

    // Parse the query params
    let mode = req.query['hub.mode'];
    let token = req.query['hub.verify_token'];
    let challenge = req.query['hub.challenge'];

    // Checks if a token and mode is in the query string of the request
    if (mode && token) {

        // Checks the mode and token sent is correct
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {

            // Responds with the challenge token from the request
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);

        } else {
            // Responds with '403 Forbidden' if verify tokens do not match
            res.sendStatus(403);
        }
    }
};

// Sends response messages via the Send API
function callSendAPI(sender_psid, response, quick_reply={"text": ""}) {
    // Construct the message body
    let request_body;

    if(!quick_reply.text){
        request_body = {
            "recipient": {
                "id": sender_psid
            },
            "message": { "text": response }
        };
    }
    else{
        request_body = {
            "recipient": {
                "id": sender_psid
            },
            "messaging_type": "RESPONSE",
            "message": quick_reply
        };
    }
    

    // Send the HTTP request to the Messenger Platform
    request({
        "uri": "https://graph.facebook.com/v7.0/me/messages",
        "qs": { "access_token": process.env.PAGE_ACCESS_TOKEN },
        "method": "POST",
        "json": request_body
    }, (err, res, body) => {
        if (!err) {
            console.log('message sent!');
        } else {
            console.error("Unable to send message:" + err);
        }
    });
}

// function for carouself gift
function callSendPromo(sender_psid, quick_reply){
    // Construct the message body
    let request_body = {
        "recipient": {
            "id": sender_psid
        },
        "messaging_type": "RESPONSE",
        "message": quick_reply
    };

    // Send the HTTP request to the Messenger Platform
    request({
        "uri": "https://graph.facebook.com/v7.0/me/messages",
        "qs": { "access_token": process.env.PAGE_ACCESS_TOKEN },
        "method": "POST",
        "json": request_body
    }, (err, res, body) => {
        if (!err) {
            console.log('message sent!');
        } else {
            console.error("Unable to send message:" + err);
        }
    });
}

// function used to count number of words in a string
function countWords(str) {
    var matches = str.match(/[\w\d\???\'-]+/gi);
    return matches ? matches.length : 0;
}

// function used to extract user first name 
// from previous latest message
function extractName(givenName=PREV_OF_LATEST){
    let name = "";
    for(let i = 3; i < givenName.length; i++){
        if (givenName[i] === ' ') break;

        name += givenName[i];
    }
    return name;
}

// function to extract date given by user
function extractDate(givenDate=PREV_OF_LATEST){
    let dt = "";
    for(let i = 3; i < givenDate.length; i++){
        if (givenDate[i] === ' ') break;

        dt += givenDate[i];
    }
    return dt;
}

function handleMessage(sender_psid, message) {
    // check kind of message
    try {
        if (message.quick_reply) {
            handleQuickReply(sender_psid, message);
        } else if (message.attachments) {
                handleAttachmentMessage(sender_psid, message);
        } else if (message.text) {
                handleTextMessage(sender_psid, message);
        } 
        else{
            callSendAPI(sender_psid,`The bot needs more training. You said "${message.text}". Try to say "Hi" or "#start_over" to restart the conversation..`);
        }
    } 
    catch (error) {
        console.error(error);
        callSendAPI(sender_psid,`An error has occured: '${error}'. We have been notified and will fix the issue shortly!`);
      }
}

function handleAttachmentMessage(sender_psid, message){
    callSendAPI(sender_psid,`From handle attachment message. You said ${message.text}`);
}

function handleTextMessage(sender_psid, message){
    // getting current message
    let mess = message.text;
    mess = mess.toLowerCase();

    PREV_OF_PREV = PREV_OF_LATEST;
    PREV_OF_LATEST = LATEST_MESSAGE;
    LATEST_MESSAGE = mess;

    // message.nlp did not work -> made a workaround
    let greeting = ["hi", "hey", "hello"];
    let accept_conv = ["yup", "yes", "yeah", "sure", "yep", "i do"];
    let deny_conv = ["no", "nah", "nope", "not now", "maybe later"];
    let thanks_conv = ["thanks", "thx", "thank you", "thank you very much", "thanks a lot", "thanks!", "thank you!"];

    let resp;

    // reinitialize conversation
    if(mess === "#start_over"){
        USER_FIRST_NAME = "";
        USER_BIRTH_DATE = "";
        LATEST_MESSAGE = "";
        PREV_OF_LATEST = "";
        PREV_OF_PREV = "";
        
        // uncomment following for clearing messages
        // ARR_MESSAGES = [];
        // COUNT_MESSAGES = 0;
    }

    // greeting case
    if(greeting.includes(mess) || mess === "#start_over"){
        if(USER_FIRST_NAME === ""){
            resp = {
                "text": "(By continuing this conversation you agree to usage of your personal information. Say 'No' if you wish to stop the conversation.) \n\nHello! Would you like to answer few questions?",
                "quick_replies":[
                  {
                    "content_type":"text",
                    "title":"Sure",
                    "payload": "sure"
                  },{
                    "content_type":"text",
                    "title":"Not now",
                    "payload": "not now"
                  }
                ]
              }
            callSendAPI(sender_psid,``, resp);
        } else{
            callSendAPI(sender_psid,`The bot needs more training. You said "${message.text}". Try to say "Hi" or "#start_over" to restart the conversation.`);
        }

    }
    // accept case
    else if(accept_conv.includes(mess)){
        if(USER_FIRST_NAME === ""){
            if (countWords(LATEST_MESSAGE) === 1 && !greeting.includes(PREV_OF_PREV)){
                for(var i = 0; i < accept_conv.length; i++){
                    if( mess.includes(accept_conv[i]) )
                      break;
                  }
                  
                if(i !== accept_conv.length) {
                    USER_FIRST_NAME = capitalizeFirstLetter(extractName());
                    console.log(USER_FIRST_NAME);
                   
                    callSendAPI(sender_psid,`We will take your first name as ${USER_FIRST_NAME}. Secondly, we would like to know your birth date. Write it down below in the format YYYY-MM-DD. Example: 1987-03-25`);    
                }
                else{
                    callSendAPI(sender_psid,`First, please write below your first name`);
                }
             }
            else{
                callSendAPI(sender_psid,`First, please write below your first name`);
            }
        }
        else if (USER_BIRTH_DATE === ""){
                if (countWords(LATEST_MESSAGE) === 1 && (extractDate().split("-").length - 1) === 2){
                    USER_BIRTH_DATE = PREV_OF_LATEST;
                    console.log(USER_BIRTH_DATE);
            
                    let resp = {
                        "text": `You agreed that your birth date is ${USER_BIRTH_DATE}. Would you like to know how many days are until your next birtday?`,
                        "quick_replies":[
                        {
                            "content_type":"text",
                            "title": "I do",
                            "payload": "i do"
                        },{
                            "content_type":"text",
                            "title":"Not interested",
                            "payload": "not interested"
                        }
                        ]
                    };
            
                    callSendAPI(sender_psid,``, resp);
                }
            else{
                callSendAPI(sender_psid,`You agreed that your first name is ${USER_FIRST_NAME}. Secondly, we would like to know your birth date. Write it down below in the format YYYY-MM-DD. Example: 1987-03-25`);
            }
         }
         else if (USER_FIRST_NAME !== "" && USER_BIRTH_DATE !== ""){
            let days_left = countBirthDays();

            // bad information introduced
            if(days_left === -1){
                callSendAPI(sender_psid,`Birth date introduced is false. If you wish to start this conversation again write "#start_over". Goodbye ????`);
            }
            else{
                // sending 2 carousel products
                let resp = initialGifts();

                callSendAPI(sender_psid,`There are ${days_left} days until your next birthday. Here are some gifts you can buy for yourself ????`);
                callSendPromo(sender_psid, resp);
            }
         }
        else {
            callSendAPI(sender_psid,`The bot needs more training. You said "${message.text}". Try to say "Hi" or "#start_over" to restart the conversation.`);
        }
        
    }
    // deny case
    else if (deny_conv.includes(mess)){
        callSendAPI(sender_psid,`Thank you for your answer. If you wish to start this conversation again write "#start_over". Goodbye ????`);
    }
    // gratitude case
    else if (thanks_conv.includes(mess)){
        callSendAPI(sender_psid,`You're welcome! If you wish to start this conversation again write "#start_over". Goodbye ????`);
    }
    // user may have introduced first name and/or birth date
    else {
        let resp;

        // if we don't know user first name yet
        if(!USER_FIRST_NAME){
            LATEST_MESSAGE = capitalizeFirstLetter(LATEST_MESSAGE);
            resp = {
                "text": "Is " + LATEST_MESSAGE + " your first name?",
                "quick_replies":[
                  {
                    "content_type":"text",
                    "title": "Yes",
                    "payload": "yes"
                  },{
                    "content_type":"text",
                    "title":"No",
                    "payload": "no"
                  }
                ]
            };

            callSendAPI(sender_psid,``, resp);

        } // if we don't know user birth date yet
         else if (!USER_BIRTH_DATE){
            resp = {
                "text": "Is " + LATEST_MESSAGE + " your birth date?",
                "quick_replies":[
                  {
                    "content_type":"text",
                    "title": "Yep",
                    "payload": "yep"
                  },{
                    "content_type":"text",
                    "title":"Not at all",
                    "payload": "not at all"
                  }
                ]
            };

            callSendAPI(sender_psid,``, resp);
        }
        // something else
        else {
            callSendAPI(sender_psid,`Thank you for your answer. If you wish to start this conversation again write "#start_over". Goodbye ????`);
        }
    }
}

// function to capitalize first letter of a word
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

// function to count birth days
function countBirthDays(birthDate=USER_BIRTH_DATE){
    var today = new Date();

    // we extract user birth date information in decimal
    var user_year = parseInt(birthDate.substring(0, 4), 10);
    var user_month = parseInt(birthDate.substring(5, 7), 10);
    var user_day = parseInt(birthDate.substring(8, 10), 10);

    // bad information introduced
    if(user_year >= today.getFullYear() || user_month > 12 || user_day > 31){
        return -1;
    }
    else{ // valid information -> proceed to calculus
        const oneDay = 24 * 60 * 60 * 1000; // hours*minutes*seconds*milliseconds
        let days_left = Math.round(Math.abs( ( (today - new Date(today.getFullYear(), user_month - 1, user_day)) / oneDay) ) );

        return days_left;
    }
}

// function get inital birth gift
function initialGifts(){
    let resp = {
        "attachment":{
            "type":"template",
            "payload":{
              "template_type":"generic",
              "elements":[
                 {
                  "title":"COWIN E7s Headphones for $59.99 + $25.23 Shipping & Import Fees",
                  "image_url":"https://m.media-amazon.com/images/I/41WzHq0SkRL._AC_UY218_.jpg",
                  "subtitle":"Active Noise Cancelling Headphones, with Bluetooth and Microphone",
                  "default_action": {
                    "type": "web_url",
                    "url": "https://www.amazon.com/Cancelling-Headphones-Bluetooth-Microphone-Comfortable/dp/B019U00D7K/ref=sr_1_1?dchild=1&keywords=headphones&qid=1599034241&s=specialty-aps&sr=1-1",
                    "webview_height_ratio": "tall",
                  },
                  "buttons":[
                    {
                        "type":"postback",
                        "title":"See similar product",
                        "payload":"looking headphones"
                    },{
                      "type":"postback",
                      "title":"Not what I was looking for",
                      "payload":"not looking headphones"
                    }              
                  ]      
                },
                {
                   "title":"Xiaomi Mi Band 4",
                  "image_url":"https://images-na.ssl-images-amazon.com/images/I/51SQSEoSr8L._AC_SL1000_.jpg",
                  "subtitle":"Incredible smartwatch",
                  "default_action": {
                    "type": "web_url",
                    "url": "https://www.amazon.com/Xiaomi-Mi-Band-4/dp/B07T4ZH692/ref=sr_1_3?dchild=1&keywords=mi+band+4&qid=1599037215&sr=8-3",
                    "webview_height_ratio": "tall",
                  },
                  "buttons":[
                    {
                        "type":"postback",
                        "title":"See similar product",
                        "payload":"looking mi band"
                    },{
                      "type":"postback",
                      "title":"Not what I was looking for",
                      "payload":"not looking mi band"
                    }              
                  ]  
                }
              ]
            }
        }
    };

    return resp;
}

// function to handle quick replies
function handleQuickReply(sender_psid, message){
    let mess = message.text;
    mess = mess.toLowerCase();

    // user agreed to answer questions
    if(mess === "sure"){
        if(!USER_FIRST_NAME){
            callSendAPI(sender_psid,`First, please write below your first name`);
        }
        else {
            callSendAPI(sender_psid,`The bot needs more training. You said "${message.text}". Try to say "Hi" or "#start_over" to restart the conversation.`);
        }
    }
    // user agreed on his first name
    else if (mess === "yes") {
        for(let i = 3; i < LATEST_MESSAGE.length; i++){
            USER_FIRST_NAME += LATEST_MESSAGE[i];

            if(LATEST_MESSAGE[i] === " ") break;
        }
        USER_FIRST_NAME = capitalizeFirstLetter(USER_FIRST_NAME);
        console.log(USER_FIRST_NAME);

        callSendAPI(sender_psid,`You agreed that your first name is ${USER_FIRST_NAME}. Secondly, we would like to know your birth date. Write it down below in the format YYYY-MM-DD. Example: 1987-03-25`);
    }
    // user agreed on his birth date
    else if (mess === "yep"){
        for(let i = 3; i < LATEST_MESSAGE.length; i++){
            USER_BIRTH_DATE += LATEST_MESSAGE[i];

            if(LATEST_MESSAGE[i] === " ") break;
        }
        console.log(USER_BIRTH_DATE);

        let resp = {
            "text": `You agreed that your birth date is ${USER_BIRTH_DATE}. Would you like to know how many days are until your next birtday?`,
            "quick_replies":[
              {
                "content_type":"text",
                "title": "I do",
                "payload": "i do"
              },{
                "content_type":"text",
                "title":"Not interested",
                "payload": "not interested"
              }
            ]
        };

        callSendAPI(sender_psid,``, resp);
    }
    // user agreed to know birth date days
    else if (mess === "i do"){
        let days_left = countBirthDays();

        // bad information introduced
        if(days_left === -1){
            callSendAPI(sender_psid,`Birth date introduced is false. If you wish to start this conversation again write "#start_over". Goodbye ????`);
        }
        else{ // valid information -> proceed to calculus

            // sending 2 carousel products
            let resp = initialGifts();

            callSendAPI(sender_psid,`There are ${days_left} days until your next birthday. Here are some gifts you can buy for yourself ????`);
            callSendPromo(sender_psid, resp);
        }
    }
    else if (mess === "not now" || mess === "no" || mess === "not at all" || mess === "not interested"){
            callSendAPI(sender_psid,`Thank you for your answer. If you wish to start this conversation again write "#start_over". Goodbye ????`);
    }
    else {
        callSendAPI(sender_psid,`The bot needs more training. You said "${message.text}". Try to say "Hi" or "#start_over" to restart the conversation.`);
    }
}

// Handles messaging_postbacks events
function handlePostback(sender_psid, received_postback) {
    // Get the payload for the postback
    let payload = received_postback.payload;

    // Set the response based on the postback payload
    if (payload === 'looking headphones' || payload === 'looking mi band') {
        // sending 2 similar carouself products
        let resp = {
            "attachment":{
                "type":"template",
                "payload":{
                  "template_type":"generic",
                  "elements":[
                     {
                      "title":"Mpow 059 Headphones for $33.99 + $17.70 Shipping & Import Fees",
                      "image_url":"https://images-na.ssl-images-amazon.com/images/I/617XS3ZQgUL._AC_SL1280_.jpg",
                      "subtitle":"Bluetooth Headphones Over Ear, Hi-Fi Stereo Wireless Headset, Foldable",
                      "default_action": {
                        "type": "web_url",
                        "url": "https://www.amazon.com/dp/B01NAJGGA2/ref=dp_cerb_2",
                        "webview_height_ratio": "tall",
                      },
                      "buttons":[
                        {
                            "type":"web_url",
                            "url":"https://www.amazon.com/s?k=headphones&crid=1TBFG5JJ5SKYQ&sprefix=head%2Caps%2C319&ref=nb_sb_ss_ts-ap-p_1_4",
                            "title":"View more headphones"
                        }            
                      ]      
                    },
                    {
                       "title":"Xiaomi Mi Band 5",
                      "image_url":"https://images-na.ssl-images-amazon.com/images/I/61UZ41QdbCL._AC_SX679_.jpg",
                      "subtitle":"Incredible smartwatch",
                      "default_action": {
                        "type": "web_url",
                        "url": "https://www.amazon.com/Xiaomi-Band-Wristband-Magnetic-Bluetooth/dp/B089NS9JW2/ref=sr_1_3?dchild=1&keywords=mi+band&qid=1599036809&sr=8-3",
                        "webview_height_ratio": "tall",
                      },
                      "buttons":[
                        {
                            "type":"web_url",
                            "url":"https://www.amazon.com/s?k=mi+band&ref=nb_sb_noss_2",
                            "title":"View more like this"
                        }               
                      ]  
                    }
                  ]
                }
            }
        };

        callSendAPI(sender_psid,`Here are 2 similar products based on earlier choice.`);
        callSendPromo(sender_psid, resp);

    } else if (payload === 'not looking headphones' || payload === 'not looking mi band') {  
        callSendAPI(sender_psid,`Thank you for your answer. If you wish to start this conversation again write "#start_over". Goodbye ????`);
    }
    else{
        callSendAPI(sender_psid,`The bot needs more training. You said "${message.text}". Try to say "Hi" or "#start_over" to restart the conversation.`);
    }
}

module.exports = {
  postWebhook: postWebhook,
  getWebhook: getWebhook,
  postMessage: postMessage
};

// module.exports = checkInDB;
// module.exports = capitalizeFirstLetter;
// module.exports = countWords;
// module.exports = countBirthDays;
// module.exports = extractDate;
// module.exports = extractName;