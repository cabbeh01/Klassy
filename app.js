const express = require("express");
const hbs = require("express-handlebars");

const app = express();

app.set("view engine","hbs");

app.engine( 'hbs', hbs( {
    extname: 'hbs',
    defaultLayout: 'layout',
    layoutsDir: __dirname + '/views/layouts/',
    partialsDir: __dirname + '/views/partials/'
}));

//Main page
app.get("/",function(req,res){
    res.render('index');
});


//Login
app.get("/login",function(req,res){
    res.send("Login");
});

app.post("/login",function(req,res){
    res.send("Post login");
});


//Register
app.get("/register",function(req,res){
    res.send("/Register");
});

app.post("/register",function(req,res){
    res.send("/");
});


//Session
app.get("/session",function(req,res){
    res.send("/");
});








app.listen(2380, function(){
    console.log("http://localhost:2380");
});