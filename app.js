const express = require("express");
const app = express();

const hbs = require("express-handlebars");
const mongo = require("mongodb").MongoClient;

const conString = require("./private");
//console.log(conString);

app.set("view engine","hbs");

app.engine( 'hbs', hbs( {
    extname: 'hbs',
    defaultLayout: 'layout',
    layoutsDir: __dirname + '/views/layouts/',
    partialsDir: __dirname + '/views/partials/'
}));

app.use("/public",express.static("public"));
app.use("/router",express.static("router"));
app.use(express.urlencoded({extended:false}));

makeConnection();
async function makeConnection(){
    const con = await mongo.connect(conString, {useNewUrlParser: true, useUnifiedTopology: true});
    const db = await con.db('dbKlassy');

    app.users = await db.collection('users');

    require('./router/routes')(app);
}

app.listen(2380, function(){
    console.log("http://localhost:2380");
});