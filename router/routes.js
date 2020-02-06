//let objectId = require('mongodb').ObjectID;
const jwt = require('jsonwebtoken');
//const secret = require('./secret');
var bcrypt = require('bcryptjs');

module.exports = async function(app){
    //Main page
    app.get("/",function(req,res){
        res.render('index',{title:"Home"});
    });


    //Login
    app.get("/login",function(req,res){
        res.render('login',{title:"Inlogging"});
    });

    app.post("/login",function(req,res){
        es.send(req.body);
    });


    //Register
    app.get("/register",function(req,res){
        res.render('register',{title:"Registrering"});
    });

    app.post("/register",async function(req,res){

        app.users.insertOne(req.body,function(err){
            console.log(err);
        });
        res.send(req.body.group);
    });


    //Session
    app.get("/session",function(req,res){
        res.send("/");
    });
}