const express             = require("express");
const homepageController  = require("../controllers/homepageController");
const chatBotController   = require("../controllers/chatBotController");
const messagesController  = require("../controllers/messagesController");
const headLinksController = require("../controllers/headLinksController");
const headerController    = require("../controllers/headerController");

let router = express.Router();

let initWebRoutes = async (app) => {
    router.get("/", homepageController.getHomepage);
    router.get("/messages", messagesController.getMessages);
    router.get("/messages/:messId", messagesController.getMessageId);
    router.delete("/messages/:messId", messagesController.deleteMessageById);

    router.get("/header", headerController.getHeader);
    router.get("/headLinks", headLinksController.getHeadLinks);
    router.get("/webhook", chatBotController.getWebhook);

    router.post("/", chatBotController.postMessage);
    router.post("/webhook", chatBotController.postWebhook);

    return app.use("/", router);
};

module.exports = initWebRoutes;