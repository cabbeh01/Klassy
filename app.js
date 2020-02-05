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

app.use("/public",express.static("public"));
app.use(express.urlencoded({extended:false}));

//Main page
app.get("/",function(req,res){
    res.render('index',{title:"Home"});
});


//Login
app.get("/login",function(req,res){
    res.render('login',{title:"Inlogging"});
});

app.post("/login",function(req,res){
    res.send(req.body);
});


//Register
app.get("/register",function(req,res){
    res.render('register',{title:"Registrering"});
});

app.post("/register",function(req,res){
    res.send(req.body.group);
});


//Session
app.get("/session",function(req,res){
    res.send("/");
});








app.listen(2380, function(){
    console.log("http://localhost:2380");
});