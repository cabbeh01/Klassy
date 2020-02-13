require("dotenv").config();

const express = require("express");
const app = express();
const cookieParser = require('cookie-parser');
const createError = require("http-errors");

const hbs = require("express-handlebars");
const mongo = require("mongodb").MongoClient;
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
app.use(cookieParser());
app.use(express.urlencoded({extended:false}));

/*app.use(function(req,res, next){
    next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {

    // render the error page
    res.status(err.status || 500);
    res.render('error');
});*/

makeConnection();
async function makeConnection(){
    const con = await mongo.connect(process.env.CONNECT_STRING, {useNewUrlParser: true, useUnifiedTopology: true});
    const db = await con.db('dbKlassy');

    app.users = await db.collection('users');

    require('./router/routes')(app);
}

app.listen(2380, function(){
    console.log("http://localhost:2380");
});