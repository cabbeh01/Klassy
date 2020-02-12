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

        let inEmail = req.body.email;
        let pass = req.body.password;

        app.users.findOne({"email": inEmail},function(err,data){

            if(!(data == null)){
                //console.log(data.password);
                //console.log(pass);
                bcrypt.compare(pass,data.password,function(err,succ){
                    if(succ){
                        switch(data.group){
                            case "0":
                                res.redirect("/teacher");
                                break;
                            case "1":
                                res.redirect("/pupil");
                                break;
                        }
                    }
                    if(err){
                        res.render('login',{title:"Registrering", errmess:"Användare eller lösenord felaktigt"});
                    }
                
                });
            }
            else{
                res.render('login',{title:"Registrering", errmess:"Användare eller lösenord felaktigt"});
            }
        });
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

    //Lärare
    app.get("/teacher",function(req,res){
        res.render('teacher',{title:"Lärare inloggad"});
    });

    //Elev
    app.get("/pupil",function(req,res){
        res.render('pupil',{title:"Elev inloggad"});
    });


    //Session
    app.get("/session",function(req,res){
        res.send("/");
    });
}