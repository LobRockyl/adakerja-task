require("dotenv").config();
const express      = require("express");
const viewEngine   = require("./config/viewEngine");
const initWebRoute = require("./routes/web");
const bodyParser   = require("body-parser");
const cors         = require("cors");

let app = express();

// config view engine
viewEngine(app);

// use body-parser to post data
app.use(bodyParser.json());
app.use(cors({
   'allowedHeaders': ['sessionId', 'Content-Type'],
   'exposedHeaders': ['sessionId'],
   'origin': '*',
   'methods': 'GET,HEAD,PUT,PATCH,POST,DELETE',
   'preflightContinue': false
 }));
app.use(bodyParser.urlencoded({ extended: true }));

// init all web routes
initWebRoute(app);

let port = process.env.PORT || 8080;

app.listen(port, ()=>{
   console.log(`Application is running on port ${port}`) ;
   console.log(`Press CTRL^C to stop the application`) ;
});