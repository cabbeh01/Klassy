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
        res.send(req.body);

        let email = req.body.email;
        let pass = req.body.pass;

        
    });


    //Register
    app.get("/register",function(req,res){
        res.render('register',{title:"Registrering"});
    });

    app.post("/register",async function(req,res){
        bcrypt.hash(req.body.password,12,function(err,hash){
            let inEmail = req.body.email;
            
            app.users.findOne({"email": inEmail},function(err,data){
                
                if(data == null){
                    req.body.password = hash;

                    app.users.insertOne(req.body,function(err){
                        console.log(err);
                    });
                    res.redirect("/login");
                }
                else{
                    res.render('register',{title:"Registrering", errmess:"Går inte registrera användaren"});
                }
                
            });

        });
        //res.send(req.body.group);
    });


    //Session
    app.get("/session",function(req,res){
        res.send("/");
    });
}